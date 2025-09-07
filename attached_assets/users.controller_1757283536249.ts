import { Controller, Get, UseGuards, Request, Patch, Post, Body, Query, Param } from '@nestjs/common';
import { JwtAuthGuard } from 'src/config';
import { UsersService } from './users.service';
import { Message } from 'src/common/utils';
import { AddBankDetailsDto, CreateVendorDto, UpdateProfileDto, UpdateVendorDto } from 'src/common/dto';

@Controller('user')
export class UsersController {
  constructor(private userService: UsersService) {}
  @UseGuards(JwtAuthGuard) // Protect the route with JWT Guard
  @Get('profile')
  async getProfile(@Request() req) {
    const userId = req.user['userId'];
    const data = await this.userService.getUserProfile(userId);

    return {
      status: 'Success',
      message: Message.userProfile,
      data: data,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/profile/update')
  async editProfile(@Request() req, @Body() payload: UpdateProfileDto) {
    const userId = req.user['userId'];
    const data = await this.userService.updateUser(userId, payload);

    return {
      status: 'Success',
      message: Message.profileUpdate,
      data,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('/vendor/onboard')
  async onboardVendor(@Request() req, @Body() createVendorDto: CreateVendorDto) {
    const userId = req.user['userId'];
    const data = await this.userService.onboardVendor(userId, createVendorDto);

    return {
      status: 'Success',
      message: Message.vendorOnboarded,
      data,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('/vendor/bank-details')
  async addBankDetails(@Request() req, @Body() bankDetailsDto: AddBankDetailsDto) {
    const userId = req.user['userId'];
    const data = await this.userService.addBankDetails(userId, bankDetailsDto);

    return {
      status: 'Success',
      message: Message.vendorDetails,
      data,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/vendor/update')
  async updateVendor(@Request() req, @Body() payload: UpdateVendorDto) {
    const userId = req.user['userId'];
    const data = await this.userService.editVendor(userId, payload);
    return {
      status: 'Success',
      message: Message.vendorUpdated,
      data,
    };
  }

  @Get('/vendor/categories')
  async getBusinessCategories(@Query('search') search?: string) {
    return this.userService.getAllBusinessCategories(search);
  }
  @Get('/vendor/category/:category')
  async getBusinessByCategory(@Param('category') category: string) {
    const data = await this.userService.getVendorsByCategory(category);
    return {
      status: 'Success',
      message: Message.vendorFetched,
      data,
    };
  }
}
