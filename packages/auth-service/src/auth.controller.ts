import {
  Controller,
  Post,
  Put,
  Get,
  Query,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { StandardResponse, HttpAuthGuard, User, AuthenticatedUser, Roles, RolesGuard } from '@food-ordering/common';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Public Endpoints ────────────────────────────────────────────────────────

  @Post('register')
  @ApiOperation({ summary: 'Register a new user (local auth)' })
  @ApiResponse({ status: 201, description: 'User registered successfully.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 409, description: 'Email already in use.' })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto.email, registerDto.password);
    return StandardResponse.success('User registered successfully', user);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email & password (local auth)' })
  @ApiResponse({ status: 200, description: 'Tokens issued.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 403, description: 'Account suspended.' })
  async login(@Body() loginDto: LoginDto) {
    const data = await this.authService.login(loginDto.email, loginDto.password);
    return StandardResponse.success('Login successful', data);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh internal JWT using refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed.' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token.' })
  async refresh(@Body() refreshDto: RefreshDto) {
    const data = await this.authService.refresh(refreshDto.refreshToken);
    return StandardResponse.success('Token refreshed successfully', data);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout — revoke Keycloak session or local refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out.' })
  async logout(
    @Body('accessToken') accessToken?: string,
    @Body('refreshToken') refreshToken?: string,
  ) {
    if (accessToken) {
      // Keycloak session revocation
      await this.authService.logout(accessToken, refreshToken);
    } else if (refreshToken) {
      // Local JWT logout (delete refresh token from DB)
      await this.authService.logoutLocal(refreshToken);
    }
    return StandardResponse.success('Logged out successfully', null);
  }

  // ─── Authenticated Endpoints ─────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(HttpAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile with addresses' })
  @ApiResponse({ status: 200, description: 'Profile retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProfile(@User() user: AuthenticatedUser) {
    const dbUser = await this.authService.findById(user.id);
    if (!dbUser) {
      throw new NotFoundException('User not found');
    }
    return StandardResponse.success('Profile retrieved successfully', {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      addresses: dbUser.addresses || [],
    });
  }

  @Put('profile/addresses')
  @UseGuards(HttpAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update delivery addresses for current user' })
  @ApiResponse({ status: 200, description: 'Addresses updated successfully.' })
  @ApiResponse({ status: 400, description: 'Addresses must be an array of strings.' })
  async updateAddresses(@User() user: AuthenticatedUser, @Body('addresses') addresses: string[]) {
    if (!Array.isArray(addresses)) {
      throw new BadRequestException('Addresses must be an array of strings');
    }
    const updated = await this.authService.updateAddresses(user.id, addresses);
    return StandardResponse.success('Addresses updated successfully', {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      addresses: updated.addresses || [],
    });
  }

  // ─── Internal / Admin Endpoints ──────────────────────────────────────────────

  @Get('users/search')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search users by email keyword (Admin only)' })
  @ApiResponse({ status: 200, description: 'User list returned.' })
  async searchUsers(@Query('q') q: string) {
    const users = await this.authService.searchUsers(q ?? '');
    return StandardResponse.success('Users retrieved', users.map(u => ({
      id: u.id, email: u.email, role: u.role, isBanned: u.isBanned,
    })));
  }

  @Get('users')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (Admin only)' })
  @ApiResponse({ status: 200, description: 'User list returned.' })
  async listAllUsers() {
    const users = await this.authService.listAllUsers();
    return StandardResponse.success('Users retrieved', users.map(u => ({
      id: u.id, email: u.email, role: u.role, isBanned: u.isBanned,
    })));
  }

  @Get('users/email/:email')
  @ApiOperation({ summary: 'Get user by email (Internal use)' })
  async getUserByEmail(@Param('email') email: string) {
    const user = await this.authService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    return StandardResponse.success('User retrieved', {
      id: user.id,
      email: user.email,
      role: user.role,
      addresses: user.addresses || [],
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID (Internal use)' })
  async getUserById(@Param('id') id: string) {
    const user = await this.authService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return StandardResponse.success('User retrieved', {
      id: user.id,
      email: user.email,
      role: user.role,
      addresses: user.addresses || [],
    });
  }

  @Post('assign-owner')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Promote user to RESTAURANT_OWNER (Admin only)' })
  async assignOwner(@Body('email') email: string) {
    const user = await this.authService.assignOwnerRole(email);
    return StandardResponse.success('User promoted to RESTAURANT_OWNER', {
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
