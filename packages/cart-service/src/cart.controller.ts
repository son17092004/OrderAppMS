import { Controller, Post, Body, Get, Put, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { CartItemDto } from './dto/cart-item.dto';
import { StandardResponse, HttpAuthGuard, RolesGuard, Roles, User, AuthenticatedUser } from '@food-ordering/common';

@ApiTags('Cart')
@Controller({ path: 'cart', version: '1' })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Post()
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an item to the shopping cart (Customer only)' })
  @ApiResponse({ status: 201, description: 'Item added successfully.' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires CUSTOMER role.' })
  async addItem(@Body() dto: CartItemDto, @User() user: AuthenticatedUser) {
    const cart = await this.cartService.addItem(user.id, dto.foodItemId, dto.quantity);
    return StandardResponse.success('Item added to cart successfully', cart);
  }

  @Get()
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve the current customer shopping cart' })
  @ApiResponse({ status: 200, description: 'Cart retrieved successfully.' })
  async getCart(@User() user: AuthenticatedUser) {
    const cart = await this.cartService.getCart(user.id);
    return StandardResponse.success('Cart retrieved successfully', cart);
  }

  @Put()
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update item quantity in the cart (Customer only)' })
  @ApiResponse({ status: 200, description: 'Cart item quantity updated successfully.' })
  async updateQuantity(@Body() dto: CartItemDto, @User() user: AuthenticatedUser) {
    const cart = await this.cartService.updateItemQuantity(user.id, dto.foodItemId, dto.quantity);
    return StandardResponse.success('Cart item quantity updated successfully', cart);
  }

  @Delete('items/:itemId')
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an item from the cart (Customer only)' })
  @ApiParam({ name: 'itemId', description: 'Food Item ID' })
  @ApiResponse({ status: 200, description: 'Item removed successfully.' })
  async removeItem(@Param('itemId') itemId: string, @User() user: AuthenticatedUser) {
    const cart = await this.cartService.removeItem(user.id, itemId);
    return StandardResponse.success('Item removed from cart successfully', cart);
  }

  @Delete()
  @UseGuards(HttpAuthGuard, RolesGuard)
  @Roles('CUSTOMER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear the shopping cart (Customer only)' })
  @ApiResponse({ status: 200, description: 'Cart cleared successfully.' })
  async clearCart(@User() user: AuthenticatedUser) {
    const cart = await this.cartService.clearCart(user.id);
    return StandardResponse.success('Cart cleared successfully', cart);
  }

  @Get('internal/:userId')
  @ApiOperation({ summary: 'Internal: Retrieve shopping cart by User ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async getCartInternal(@Param('userId') userId: string) {
    return this.cartService.getCart(userId);
  }

  @Delete('internal/:userId')
  @ApiOperation({ summary: 'Internal: Clear shopping cart by User ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  async clearCartInternal(@Param('userId') userId: string) {
    return this.cartService.clearCart(userId);
  }
}
