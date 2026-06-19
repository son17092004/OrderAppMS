import {
  Controller,
  Post,
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
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getProfile(@User() user: AuthenticatedUser) {
    return StandardResponse.success('Profile retrieved successfully', user);
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

  @Post('users/:userId/role')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user role (Admin only)' })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body('role') role: string,
  ) {
    const { UserRole } = await import('./entities/user.entity');
    const mappedRole = (UserRole as any)[role];
    if (!mappedRole) throw new BadRequestException('Invalid role');
    const user = await this.authService.updateUserRole(userId, mappedRole);
    return StandardResponse.success('User role updated successfully', {
      id: user.id,
      email: user.email,
      role: user.role,
    });
  }

  @Post('ban/:userId')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ban or unban a user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User ban status updated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin only.' })
  async banUser(
    @Param('userId') userId: string,
    @Body('isBanned') isBanned: boolean,
  ) {
    const user = await this.authService.banUser(userId, isBanned);
    return StandardResponse.success(
      isBanned ? 'User has been banned' : 'User has been unbanned',
      { id: user.id, email: user.email, role: user.role, isBanned: user.isBanned },
    );
  }

  @Post('keycloak/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync a Keycloak user into local DB after first login' })
  async syncKeycloakUser(
    @Body('keycloakId') keycloakId: string,
    @Body('email') email: string,
    @Body('role') role: string,
  ) {
    const { UserRole } = await import('./entities/user.entity');
    const mappedRole = (UserRole as any)[role] ?? UserRole.CUSTOMER;
    const user = await this.authService.syncKeycloakUser(keycloakId, email, mappedRole);
    return StandardResponse.success('User synced', {
      id: user.id,
      email: user.email,
      role: user.role,
      keycloakId: user.keycloakId,
    });
  }
}
