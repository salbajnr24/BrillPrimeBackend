// src/commodities/commodities.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AddCommodityDto, UpdateCommodityDto } from 'src/common/dto';
import { Message } from 'src/common/utils';
import { prisma } from 'src/prisma';
@Injectable()
export class CommoditiesService {
  //   constructor(private prisma: PrismaService) {}

  // Add a new commodity (Vendor only)
  async addCommodity(vendorId: string, commodityData: AddCommodityDto) {
    const data = await prisma.commodity.create({
      data: {
        ...commodityData,
        vendorId,
      },
    });
    if (!data) {
      throw new BadRequestException('Failed to add commodity');
    }

    return data;
  }

  // Remove a commodity (Vendor only)
  async removeCommodity(vendorId: string, commodityId: string) {
    const commodity = await prisma.commodity.findUnique({
      where: { id: commodityId },
    });

    if (!commodity) {
      throw new NotFoundException('Commodity not found');
    }

    // Ensure the vendor owns the commodity
    if (commodity.vendorId !== vendorId) {
      throw new ForbiddenException('You do not have permission to delete this commodity');
    }

    return await prisma.commodity.delete({ where: { id: commodityId } });
  }

  // Get all commodities (Consumers and Vendors)
  async getAllVendorCommodities(vendorId: string) {
    return await prisma.commodity.findMany({ where: { vendorId } });
  }

  async updateCommodity(commodityId: string, vendorId: string, updateData: UpdateCommodityDto) {
    const commodity = await prisma.commodity.findFirst({ where: { id: commodityId } });
    if (!commodity) {
      throw new NotFoundException(Message.commodityNotFound);
    }

    if (commodity.vendorId !== vendorId) {
      throw new UnauthorizedException(Message.unauthorizedCommodityVendor);
    }

    return await prisma.commodity.update({ where: { id: commodityId }, data: updateData });
  }

  async getCommodity(commodityId: string) {
    const commodity = await prisma.commodity.findFirst({ where: { id: commodityId } });

    if (!commodity) {
      throw new NotFoundException(Message.commodityNotFound);
    }

    return commodity;
  }

  async getAllCommodities() {
    const commodities = await prisma.commodity.findMany({
      where: { isDeleted: false },
      include: {
        Vendor: { select: { id: true, fullName: true, email: true, password: true, imageUrl: true, phone: true } },
      },
    });

    if (!commodities) {
      return {};
    }

    return commodities;
  }
  async getVendorCommodities(vendorId: string) {
    const commodity = await prisma.commodity.findMany({ where: { vendorId } });
    if (!commodity) {
      throw new NotFoundException(Message.commodityNotFound);
    }
    return commodity;
  }

  async getAllSubcategories(search?: string) {
    const data = await prisma.commodity.findMany({
      where: {
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
      include: {
        Vendor: {
          select: {
            id: true,
            email: true,
            fullName: true,
            imageUrl: true,
            phone: true,
            location: true,
          },
        },
      },
    });

    return data;
    // return await prisma.commodityCategory.findMany({
    //   where: {
    //     name: {
    //       contains: search,
    //       mode: 'insensitive', // For case-insensitive search
    //     },
    //   },
    //   include: {
    //     businessCategory: true,
    //   },
    // });
  }
}
