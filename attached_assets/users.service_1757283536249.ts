import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from 'src/common';
import { AddBankDetailsDto, CreateVendorDto, UpdateProfileDto, UpdateVendorDto } from 'src/common/dto';
import { prisma } from 'src/prisma';

@Injectable()
export class UsersService {
  async getUserProfile(userId: string) {
    // Fetch the user based on userId
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        vendor: true,
        driver: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async onboardVendor(userId: string, createVendorDto: CreateVendorDto) {
    const { openingHours, ...vendorData } = createVendorDto;

    // Create the vendor
    const vendor = await prisma.vendor.create({
      data: {
        ...vendorData,
        userId,
        openingHours: {
          create: openingHours, // Create associated opening hours
        },
      },
      include: {
        openingHours: true, // Include opening hours in the response
      },
    });

    return vendor;
  }

  async addBankDetails(userId: string, payload: AddBankDetailsDto) {
    const { bankCode, bankName, accountName, accountNumber } = payload;

    try {
      // Create the vendor
      const vendor = await prisma.vendor.update({
        where: { userId },
        data: {
          bankCode,
          bankName,
          accountName,
          accountNumber,
        },
      });

      return vendor;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async updateUser(id: string, editUserDto: UpdateProfileDto) {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    return prisma.user.update({
      where: { id },
      data: { ...editUserDto },
    });
  }

  async editVendor(id: string, editVendorDto: UpdateVendorDto) {
    const { openingHours, ...vendorData } = editVendorDto;

    // return { ...vendorData, openingHours };

    // Check if the vendor exists
    const vendor = await prisma.vendor.findUnique({ where: { userId: id } });
    if (!vendor) {
      throw new NotFoundException(`Vendor not found`);
    }

    const openingHoursUpdate = await Promise.all(
      openingHours.map((oh) =>
        prisma.openingHours.upsert({
          where: {
            vendorId_dayOfWeek: {
              vendorId: vendor.id, // Unique constraint on vendorId + dayOfWeek
              dayOfWeek: oh.dayOfWeek,
            },
          },
          update: {
            openTime: oh.openTime,
            closeTime: oh.closeTime,
          },
          create: {
            vendorId: vendor.id,
            dayOfWeek: oh.dayOfWeek,
            openTime: oh.openTime,
            closeTime: oh.closeTime,
          },
        }),
      ),
    );

    const updatedVendor = await prisma.vendor.update({
      where: { id: vendor.id },
      data: { ...vendorData },
      include: { openingHours: true },
    });

    return updatedVendor;
  }

  async getAllBusinessCategories(search?: string) {
    return await prisma.businessCategory.findMany({
      where: {
        OR: [
          {
            name: {
              contains: search,
              mode: 'insensitive', // Case-insensitive search
            },
          },
          {
            subcategories: {
              some: {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      },
    });
  }

  async getVendorsByCategory(category: string) {
    const data = await prisma.vendor.findMany({
      where: { businessCategory: { contains: category, mode: 'insensitive' } },
    });
    if (!data) {
      return [];
    }

    return data;
  }
}
