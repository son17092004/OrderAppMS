import {
  Controller, Post, Body, Get, Param, Put, Patch, Delete,
  UseGuards, UseInterceptors, UploadedFiles,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { RestaurantService } from './restaurant.service';
import { CloudinaryService } from './cloudinary.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateFoodItemDto } from './dto/create-food-item.dto';
import { StandardResponse, HttpAuthGuard, RolesGuard, Roles, User, AuthenticatedUser } from '@food-ordering/common';

@ApiTags('Restaurants')
@Controller({ path: 'restaurants', version: '1' })
export class RestaurantController {
  constructor(
    private readonly restaurantService: RestaurantService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new restaurant (Admin only)' })
  @ApiResponse({ status: 201, description: 'Restaurant created successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires ADMIN role.' })
  async create(@Body() dto: CreateRestaurantDto, @User() admin: AuthenticatedUser) {
    let ownerId: string;
    try {
      const authRes = await fetch('http://auth-service:3001/v1/auth/assign-owner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': admin.id,
          'x-user-email': admin.email,
          'x-user-role': admin.role,
        },
        body: JSON.stringify({ email: dto.ownerEmail }),
      });
      const authData = await authRes.json() as any;
      if (!authRes.ok || !authData.success) {
        throw new BadRequestException(authData.message || 'Failed to assign restaurant owner');
      }
      ownerId = authData.data.id;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Auth service communication error: ${err.message}`);
    }

    const restaurant = await this.restaurantService.createRestaurant(dto.name, ownerId, dto.address, dto.phone, dto.images);
    return StandardResponse.success('Restaurant created successfully', restaurant);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active restaurants' })
  @ApiResponse({ status: 200, description: 'List of active restaurants retrieved successfully.' })
  async findAll() {
    const restaurants = await this.restaurantService.findAllActive();
    return StandardResponse.success('Restaurants retrieved successfully', restaurants);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get restaurant details by ID' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({ status: 200, description: 'Restaurant details retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Restaurant not found.' })
  async findOne(@Param('id') id: string) {
    const restaurant = await this.restaurantService.findById(id);
    return StandardResponse.success('Restaurant details retrieved successfully', restaurant);
  }

  @Put(':id')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update restaurant details (Owner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({ status: 200, description: 'Restaurant updated successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Not authorized to manage this restaurant.' })
  @ApiResponse({ status: 404, description: 'Restaurant not found.' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateRestaurantDto> & { isActive?: boolean }, @User() user: AuthenticatedUser) {
    const isAdmin = user.role === 'ADMIN';
    const restaurant = await this.restaurantService.updateRestaurant(id, user.id, isAdmin, dto);
    return StandardResponse.success('Restaurant updated successfully', restaurant);
  }

  @Delete(':id')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a restaurant (Admin only)' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({ status: 200, description: 'Restaurant deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires ADMIN role.' })
  @ApiResponse({ status: 404, description: 'Restaurant not found.' })
  async remove(@Param('id') id: string, @User() user: AuthenticatedUser) {
    await this.restaurantService.deleteRestaurant(id, user.id, true);
    return StandardResponse.success('Restaurant deleted successfully');
  }

  @Post(':id/categories')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a menu category in a restaurant (Owner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({ status: 201, description: 'Category created successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Not authorized to manage this restaurant.' })
  async createCategory(@Param('id') id: string, @Body() dto: CreateCategoryDto, @User() user: AuthenticatedUser) {
    const isAdmin = user.role === 'ADMIN';
    const category = await this.restaurantService.createCategory(id, user.id, isAdmin, dto.name);
    return StandardResponse.success('Category created successfully', category);
  }

  @Post(':id/items')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a food item in a category (Owner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({ status: 201, description: 'Food item created successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Not authorized to manage this restaurant.' })
  async createFoodItem(
    @Param('id') id: string,
    @Body() dto: CreateFoodItemDto,
    @User() user: AuthenticatedUser
  ) {
    const isAdmin = user.role === 'ADMIN';
    const foodItem = await this.restaurantService.createFoodItem(
      id,
      dto.categoryId,
      user.id,
      isAdmin,
      dto.name,
      dto.description,
      dto.price,
      dto.images
    );
    return StandardResponse.success('Food item created successfully', foodItem);
  }

  @Get(':id/menu')
  @ApiOperation({ summary: 'Get full menu of a restaurant' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({ status: 200, description: 'Restaurant menu retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Restaurant not found.' })
  async getMenu(@Param('id') id: string) {
    const menu = await this.restaurantService.getMenu(id);
    return StandardResponse.success('Restaurant menu retrieved successfully', menu);
  }

  @Get('internal/items/:itemId')
  @ApiOperation({ summary: 'Internal: Get food item details by ID' })
  @ApiParam({ name: 'itemId', description: 'Food Item ID' })
  @ApiResponse({ status: 200, description: 'Food item details retrieved successfully.' })
  async findFoodItemInternal(@Param('itemId') itemId: string) {
    return this.restaurantService.findFoodItemById(itemId);
  }

  // ─── Image Upload & Delete Endpoints ─────────────────────────────────────────

  @Post(':id/images')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload restaurant images to Cloudinary (Owner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiBody({
    description: 'One or more image files (field name: files)',
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Images uploaded and saved to restaurant.' })
  @UseInterceptors(
    FilesInterceptor('files', 10, { storage: memoryStorage() }),
  )
  async uploadRestaurantImages(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @User() user: AuthenticatedUser,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No files uploaded');
    const urls = await this.cloudinaryService.uploadFiles(files, `restaurants/${id}`);
    const restaurant = await this.restaurantService.findById(id);
    const merged = [...(restaurant.images ?? []), ...urls];
    const isAdmin = user.role === 'ADMIN';
    const updated = await this.restaurantService.updateRestaurant(id, user.id, isAdmin, { images: merged });
    return StandardResponse.success('Images uploaded successfully', { images: updated.images });
  }

  @Delete(':id/images')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a restaurant image (Owner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiBody({
    description: 'The image URL to delete',
    schema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
      },
      required: ['imageUrl'],
    },
  })
  @ApiResponse({ status: 200, description: 'Image deleted successfully.' })
  async deleteRestaurantImage(
    @Param('id') id: string,
    @Body('imageUrl') imageUrl: string,
    @User() user: AuthenticatedUser,
  ) {
    if (!imageUrl) throw new BadRequestException('imageUrl is required');
    const restaurant = await this.restaurantService.findById(id);
    if (restaurant.ownerId !== user.id) {
      throw new NotFoundException('You do not own this restaurant');
    }
    const updatedImages = (restaurant.images ?? []).filter(img => img !== imageUrl);
    const isAdmin = user.role === 'ADMIN';
    const updated = await this.restaurantService.updateRestaurant(id, user.id, isAdmin, { images: updatedImages });
    return StandardResponse.success('Image deleted successfully', { images: updated.images });
  }

  @Post('items/:itemId/images')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload food item images to Cloudinary (Owner/Admin only)' })
  @ApiParam({ name: 'itemId', description: 'Food Item ID' })
  @ApiBody({
    description: 'One or more image files (field name: files)',
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Images uploaded and saved to food item.' })
  @UseInterceptors(
    FilesInterceptor('files', 10, { storage: memoryStorage() }),
  )
  async uploadFoodItemImages(
    @Param('itemId') itemId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @User() user: AuthenticatedUser,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No files uploaded');
    const foodItem = await this.restaurantService.findFoodItemById(itemId);
    const restaurant = await this.restaurantService.findById(foodItem.category.restaurantId);
    if (restaurant.ownerId !== user.id) {
      throw new NotFoundException('You do not own this restaurant');
    }
    const urls = await this.cloudinaryService.uploadFiles(files, `food-items/${itemId}`);
    const merged = [...(foodItem.images ?? []), ...urls];
    const updated = await this.restaurantService.updateFoodItemImages(itemId, merged);
    return StandardResponse.success('Images uploaded successfully', { images: updated.images });
  }

  @Delete('items/:itemId/images')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a food item image (Owner/Admin only)' })
  @ApiParam({ name: 'itemId', description: 'Food Item ID' })
  @ApiBody({
    description: 'The image URL to delete',
    schema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
      },
      required: ['imageUrl'],
    },
  })
  @ApiResponse({ status: 200, description: 'Image deleted successfully.' })
  async deleteFoodItemImage(
    @Param('itemId') itemId: string,
    @Body('imageUrl') imageUrl: string,
    @User() user: AuthenticatedUser,
  ) {
    if (!imageUrl) throw new BadRequestException('imageUrl is required');
    const foodItem = await this.restaurantService.findFoodItemById(itemId);
    const restaurant = await this.restaurantService.findById(foodItem.category.restaurantId);
    if (restaurant.ownerId !== user.id) {
      throw new NotFoundException('You do not own this restaurant');
    }
    const updatedImages = (foodItem.images ?? []).filter(img => img !== imageUrl);
    const updated = await this.restaurantService.updateFoodItemImages(itemId, updatedImages);
    return StandardResponse.success('Image deleted successfully', { images: updated.images });
  }

  @Delete('items/:itemId')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a food item (Owner/Admin only)' })
  @ApiParam({ name: 'itemId', description: 'Food Item ID' })
  @ApiResponse({ status: 200, description: 'Food item deleted successfully.' })
  async deleteFoodItem(
    @Param('itemId') itemId: string,
    @User() user: AuthenticatedUser,
  ) {
    const isAdmin = user.role === 'ADMIN';
    await this.restaurantService.deleteFoodItem(itemId, user.id, isAdmin);
    return StandardResponse.success('Food item deleted successfully');
  }
  @Patch('items/:itemId')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle food item availability (Owner/Admin only)' })
  @ApiParam({ name: 'itemId', description: 'Food Item ID' })
  @ApiResponse({ status: 200, description: 'Food item updated successfully.' })
  async updateFoodItemAvailability(
    @Param('itemId') itemId: string,
    @Body('isAvailable') isAvailable: boolean,
    @User() user: AuthenticatedUser,
  ) {
    const isAdmin = user.role === 'ADMIN';
    const updated = await this.restaurantService.updateFoodItemAvailability(itemId, isAvailable, user.id, isAdmin);
    return StandardResponse.success('Food item updated successfully', updated);
  }
}
