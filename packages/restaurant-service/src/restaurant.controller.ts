import {
  Controller, Post, Body, Get, Param, Put, Delete,
  UseGuards, UseInterceptors, UploadedFiles,
  BadRequestException,
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
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new restaurant (Owner/Admin only)' })
  @ApiResponse({ status: 201, description: 'Restaurant created successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires RESTAURANT_OWNER or ADMIN role.' })
  async create(@Body() dto: CreateRestaurantDto, @User() user: AuthenticatedUser) {
    const restaurant = await this.restaurantService.createRestaurant(dto.name, user.id, dto.address, dto.phone, dto.images);
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
  async update(@Param('id') id: string, @Body() dto: Partial<CreateRestaurantDto>, @User() user: AuthenticatedUser) {
    const restaurant = await this.restaurantService.updateRestaurant(id, user.id, dto);
    return StandardResponse.success('Restaurant updated successfully', restaurant);
  }

  @Delete(':id')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('RESTAURANT_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a restaurant (Owner/Admin only)' })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({ status: 200, description: 'Restaurant deleted successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Not authorized to manage this restaurant.' })
  @ApiResponse({ status: 404, description: 'Restaurant not found.' })
  async remove(@Param('id') id: string, @User() user: AuthenticatedUser) {
    await this.restaurantService.deleteRestaurant(id, user.id);
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
    const category = await this.restaurantService.createCategory(id, user.id, dto.name);
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
    @Body('categoryId') categoryId: string,
    @Body() dto: CreateFoodItemDto,
    @User() user: AuthenticatedUser
  ) {
    const foodItem = await this.restaurantService.createFoodItem(
      id,
      categoryId,
      user.id,
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

  // ─── Image Upload Endpoints ─────────────────────────────────────────────────

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
    const updated = await this.restaurantService.updateRestaurant(id, user.id, { images: merged });
    return StandardResponse.success('Images uploaded successfully', { images: updated.images });
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
  ) {
    if (!files || files.length === 0) throw new BadRequestException('No files uploaded');
    const foodItem = await this.restaurantService.findFoodItemById(itemId);
    const urls = await this.cloudinaryService.uploadFiles(files, `food-items/${itemId}`);
    const merged = [...(foodItem.images ?? []), ...urls];
    const updated = await this.restaurantService.updateFoodItemImages(itemId, merged);
    return StandardResponse.success('Images uploaded successfully', { images: updated.images });
  }
}
