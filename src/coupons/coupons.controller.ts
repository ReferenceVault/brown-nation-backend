import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { AuthenticatedUser } from '../common/types/auth.types';
import { buildPaginatedResult } from '../common/utils/pagination.util';
import { PrismaService } from '../database/prisma.service';
import { CouponsService } from './coupons.service';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(
    private readonly couponsService: CouponsService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiBearerAuth('access-token')
  @Post('validate')
  @ApiOperation({
    summary: 'Validate a coupon code against a set of cart lines and preview its discount',
  })
  async validate(@CurrentUser() user: AuthenticatedUser, @Body() dto: ValidateCouponDto) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((item) => item.productId) } },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const variantIds = dto.items
      .map((item) => item.variantId)
      .filter((id): id is string => id !== undefined);
    const variants = variantIds.length
      ? await this.prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
      : [];
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

    const items = dto.items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new AppException(
          ErrorCode.PRODUCT_NOT_FOUND,
          'Product not found',
          HttpStatus.BAD_REQUEST,
        );
      }
      const variant = item.variantId ? variantMap.get(item.variantId) : undefined;
      return {
        productId: product.id,
        categoryId: product.categoryId,
        quantity: item.quantity,
        unitPrice: variant?.price ?? product.price,
      };
    });

    const result = await this.couponsService.validateForItems(dto.code, user.id, items);

    return {
      code: result.coupon.code,
      discountType: result.coupon.discountType,
      discountValue: result.coupon.discountValue,
      discountAmount: result.discountAmount,
      eligibleSubtotal: result.eligibleSubtotal,
    };
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Get()
  @ApiOperation({ summary: 'List coupons (admin only)' })
  async findAll(@Query() query: CouponQueryDto) {
    const { items, total } = await this.couponsService.findAll(query);
    return buildPaginatedResult(items, total, query.page, query.limit);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Get(':id')
  @ApiOperation({ summary: 'Get a coupon by id (admin only)' })
  async findOne(@Param('id') id: string) {
    return this.couponsService.findOne(id);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a coupon (admin only)' })
  async create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a coupon (admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.couponsService.update(id, dto);
  }

  @ApiBearerAuth('access-token')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a coupon (admin only)' })
  async remove(@Param('id') id: string) {
    await this.couponsService.remove(id);
    return { message: 'Coupon deleted successfully' };
  }
}
