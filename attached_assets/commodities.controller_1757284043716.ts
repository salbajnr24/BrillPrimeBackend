// src/commodities/commodities.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  //   Req,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CommoditiesService } from './commodities.service';
import { JwtAuthGuard, Roles, RolesGuard } from 'src/config';
import { Role } from 'src/common';
import { AddCommodityDto, UpdateCommodityDto } from 'src/common/dto';
import { Message } from 'src/common/utils';

@Controller('commodities')
export class CommoditiesController {
  constructor(private commoditiesService: CommoditiesService) {}

  @Get('/subcategories')
  async getSubcategories(@Query('search') search?: string) {
    const data = await this.commoditiesService.getAllSubcategories(search);
    return {
      status: 'Success',
      message: Message.categoriesFetched,
      data: data,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENDOR)
  @Post('add')
  async addCommodity(@Request() req, @Body() payload: AddCommodityDto) {
    const vendorId = req.user['userId'];
    const data = await this.commoditiesService.addCommodity(vendorId, payload);

    return {
      status: 'Success',
      message: Message.addCommodity,
      data: data,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENDOR) // Only allow vendors to add commodities
  @Post('update/:id')
  async updateCommodity(@Request() req, @Param('id') commodityId: string, @Body() payload: UpdateCommodityDto) {
    const vendorId = req.user['userId'];
    const data = await this.commoditiesService.updateCommodity(commodityId, vendorId, payload);

    return {
      status: 'Success',
      message: Message.updateCommodity,
      data: data,
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENDOR) // Only allow vendors to remove commodities
  @Delete('remove/:id')
  async removeCommodity(@Request() req, @Param('id') commodityId: string) {
    const vendorId = req.user['userId']; // Extract vendorId from JWT
    const data = await this.commoditiesService.removeCommodity(vendorId, commodityId);

    return {
      status: 'Success',
      message: Message.removeCommodity,
      data: data,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/all')
  async getAllCommodities(@Request() req) {
    // const vendorId = req.user['userId'];
    const data = await this.commoditiesService.getAllCommodities();
    return {
      status: 'Success',
      message: Message.getCommodities,
      data: data,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:id')
  async getCommodity(@Request() req, @Param('id') commodityId: string) {
    // const vendorId = req.user['userId'];
    const data = await this.commoditiesService.getCommodity(commodityId);
    return {
      status: 'Success',
      message: Message.getCommodities,
      data: data,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('vendor/:id')
  async getVendorCommodities(@Request() req, @Param('id') vendorId: string) {
    // const vendorId = req.user['userId'];
    const data = await this.commoditiesService.getVendorCommodities(vendorId);

    return {
      status: 'Success',
      message: Message.getVendorCommodities,
      data: data,
    };
  }

  // @Get('/subcategories')
  // async getSubcategories(@Query('search') search?: string) {
  //   const data = this.commoditiesService.getAllSubcategories(search);
  //   return {
  //     status: 'Success',
  //     message: Message.getVendorCommodities,
  //     data: data,
  //   };
  // }

  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(Role.VENDOR) // Only allow vendors to view orders for their commodities
  // @Get('orders')
  // async getVendorOrders(@Request() req) {
  //   const vendorId = req.user['id']; // Extract vendorId from JWT
  //   return this.commoditiesService.getVendorOrders(vendorId);
  // }
}
