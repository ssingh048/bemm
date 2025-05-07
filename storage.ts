import { db } from "@db";
import * as schema from "@shared/schema";
import { eq, and, desc, gte, lt, count, sql, like, or, sum, isNull } from "drizzle-orm";
import { activities } from "@shared/schema";

export const storage = {
  // Activity logging operations
  createActivity: async (activityData: Omit<schema.InsertActivity, "id" | "createdAt">) => {
    return await db.insert(schema.activities).values(activityData).returning();
  },
  
  getActivityById: async (id: number) => {
    return await db.query.activities.findFirst({
      where: eq(schema.activities.id, id),
      with: {
        user: true
      }
    });
  },
  
  getAllActivities: async (page = 1, perPage = 15, search = "", action = "all", period = "all_time", sort = "date", direction = "desc") => {
    const offset = (page - 1) * perPage;
    
    let conditions = [];
    
    if (search) {
      const users = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(
          or(
            like(schema.users.name, `%${search}%`),
            like(schema.users.email, `%${search}%`)
          )
        );
      
      const userIds = users.map(u => u.id);
      
      if (userIds.length > 0) {
        conditions.push(
          sql`${schema.activities.userId} IN (${userIds.join(',')})` as any
        );
      } else if (search) {
        conditions.push(
          like(schema.activities.details, `%${search}%`)
        );
      }
    }
    
    if (action !== "all") {
      conditions.push(eq(schema.activities.action, action));
    }
    
    if (period !== "all_time") {
      const today = new Date();
      
      switch (period) {
        case "today": {
          const startOfDay = new Date(today);
          startOfDay.setHours(0, 0, 0, 0);
          conditions.push(gte(schema.activities.createdAt, startOfDay));
          break;
        }
        case "this_week": {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
          startOfWeek.setHours(0, 0, 0, 0);
          conditions.push(gte(schema.activities.createdAt, startOfWeek));
          break;
        }
        case "this_month": {
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          conditions.push(gte(schema.activities.createdAt, firstDayOfMonth));
          break;
        }
      }
    }
    
    let whereClause = undefined;
    if (conditions.length > 0) {
      whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    }
    
    let orderByClause: any;
    switch (sort) {
      case "id":
        orderByClause = direction === "asc" ? schema.activities.id : desc(schema.activities.id);
        break;
      case "action":
        orderByClause = direction === "asc" ? schema.activities.action : desc(schema.activities.action);
        break;
      case "date":
      default:
        orderByClause = direction === "asc" ? schema.activities.createdAt : desc(schema.activities.createdAt);
        break;
    }
    
    // Join with users table to get names and emails
    const activitiesWithUsers = await db.select({
      id: schema.activities.id,
      userId: schema.activities.userId,
      userName: schema.users.name,
      userEmail: schema.users.email,
      action: schema.activities.action,
      details: schema.activities.details,
      createdAt: schema.activities.createdAt
    })
    .from(schema.activities)
    .leftJoin(schema.users, eq(schema.activities.userId, schema.users.id))
    .where(whereClause || sql`1=1`)
    .orderBy(orderByClause)
    .limit(perPage)
    .offset(offset);
    
    const totalResults = await db.select({ count: count() })
      .from(schema.activities)
      .where(whereClause || sql`1=1`)
      .execute();
    
    return {
      activities: activitiesWithUsers,
      total: totalResults[0]?.count || 0
    };
  },
  // User operations
  createUser: async (user: Omit<schema.InsertUser, "id">) => {
    return await db.insert(schema.users).values(user).returning();
  },
  
  getUserById: async (id: number) => {
    return await db.query.users.findFirst({
      where: eq(schema.users.id, id)
    });
  },
  
  getUserByEmail: async (email: string) => {
    return await db.query.users.findFirst({
      where: eq(schema.users.email, email)
    });
  },
  
  updateUser: async (id: number, userData: Partial<schema.InsertUser>) => {
    return await db.update(schema.users)
      .set(userData)
      .where(eq(schema.users.id, id))
      .returning();
  },
  
  deleteUser: async (id: number) => {
    return await db.delete(schema.users)
      .where(eq(schema.users.id, id))
      .returning();
  },
  
  getAllUsers: async (page = 1, perPage = 10, search = "") => {
    const offset = (page - 1) * perPage;
    
    let whereClause = undefined;
    if (search) {
      whereClause = or(
        like(schema.users.name, `%${search}%`),
        like(schema.users.email, `%${search}%`)
      );
    }
    
    const users = await db.query.users.findMany({
      where: whereClause,
      limit: perPage,
      offset,
      orderBy: desc(schema.users.createdAt)
    });
    
    const totalResults = await db.select({ count: count() })
      .from(schema.users)
      .where(whereClause || sql`1=1`)
      .execute();
    
    return {
      users,
      total: totalResults[0]?.count || 0
    };
  },
  
  getTotalUsers: async () => {
    const result = await db.select({ count: count() })
      .from(schema.users)
      .execute();
    
    return result[0]?.count || 0;
  },
  
  getUserGrowthPercentage: async () => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const currentPeriodUsers = await db.select({ count: count() })
      .from(schema.users)
      .where(
        and(
          gte(schema.users.createdAt, thirtyDaysAgo),
          lt(schema.users.createdAt, today)
        )
      )
      .execute();
    
    const previousPeriodUsers = await db.select({ count: count() })
      .from(schema.users)
      .where(
        and(
          gte(schema.users.createdAt, sixtyDaysAgo),
          lt(schema.users.createdAt, thirtyDaysAgo)
        )
      )
      .execute();
    
    const currentCount = currentPeriodUsers[0]?.count || 0;
    const previousCount = previousPeriodUsers[0]?.count || 0;
    
    if (previousCount === 0) {
      return currentCount > 0 ? 100 : 0;
    }
    
    return Math.round(((currentCount - previousCount) / previousCount) * 100);
  },
  
  // Contact operations
  createContact: async (contact: Omit<schema.InsertContact, "id">) => {
    return await db.insert(schema.contacts).values(contact).returning();
  },
  
  getContactById: async (id: number) => {
    return await db.query.contacts.findFirst({
      where: eq(schema.contacts.id, id)
    });
  },
  
  updateContact: async (id: number, contactData: Partial<schema.Contact>) => {
    return await db.update(schema.contacts)
      .set(contactData)
      .where(eq(schema.contacts.id, id))
      .returning();
  },
  
  deleteContact: async (id: number) => {
    return await db.delete(schema.contacts)
      .where(eq(schema.contacts.id, id))
      .returning();
  },
  
  getAllContacts: async (page = 1, perPage = 10, search = "", status = "all") => {
    const offset = (page - 1) * perPage;
    
    let conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(schema.contacts.name, `%${search}%`),
          like(schema.contacts.email, `%${search}%`),
          like(schema.contacts.message, `%${search}%`)
        )
      );
    }
    
    if (status !== "all") {
      conditions.push(eq(schema.contacts.status, status));
    }
    
    let whereClause = undefined;
    if (conditions.length > 0) {
      whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    }
    
    const contacts = await db.query.contacts.findMany({
      where: whereClause,
      limit: perPage,
      offset,
      orderBy: desc(schema.contacts.createdAt)
    });
    
    const totalResults = await db.select({ count: count() })
      .from(schema.contacts)
      .where(whereClause || sql`1=1`)
      .execute();
    
    return {
      contacts,
      total: totalResults[0]?.count || 0
    };
  },
  
  getNewContactsCount: async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await db.select({ count: count() })
      .from(schema.contacts)
      .where(gte(schema.contacts.createdAt, thirtyDaysAgo))
      .execute();
    
    return result[0]?.count || 0;
  },
  
  getUnreadContactsCount: async () => {
    const result = await db.select({ count: count() })
      .from(schema.contacts)
      .where(eq(schema.contacts.status, "unread"))
      .execute();
    
    return result[0]?.count || 0;
  },
  
  // Donation operations
  createDonation: async (donation: Omit<schema.InsertDonation, "id">) => {
    return await db.insert(schema.donations).values(donation).returning();
  },
  
  getDonationById: async (id: number) => {
    return await db.query.donations.findFirst({
      where: eq(schema.donations.id, id),
      with: {
        user: true
      }
    });
  },
  
  updateDonation: async (id: number, donationData: Partial<schema.Donation>) => {
    return await db.update(schema.donations)
      .set(donationData)
      .where(eq(schema.donations.id, id))
      .returning();
  },
  
  getDonationsByUserId: async (userId: number, page = 1, perPage = 10) => {
    const offset = (page - 1) * perPage;
    
    const donations = await db.query.donations.findMany({
      where: eq(schema.donations.userId, userId),
      limit: perPage,
      offset,
      orderBy: desc(schema.donations.createdAt)
    });
    
    const totalResults = await db.select({ count: count() })
      .from(schema.donations)
      .where(eq(schema.donations.userId, userId))
      .execute();
    
    return {
      donations,
      total: totalResults[0]?.count || 0
    };
  },
  
  getAllDonations: async (page = 1, perPage = 10, search = "", status = "all", period = "all_time", sort = "date", direction = "desc") => {
    const offset = (page - 1) * perPage;
    
    let conditions = [];
    
    if (search) {
      const users = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(
          or(
            like(schema.users.name, `%${search}%`),
            like(schema.users.email, `%${search}%`)
          )
        );
      
      const userIds = users.map(u => u.id);
      
      if (userIds.length > 0) {
        conditions.push(
          sql`${schema.donations.userId} IN (${userIds.join(',')})` as any
        );
      } else {
        // If no users match, return empty result
        return {
          donations: [],
          total: 0
        };
      }
    }
    
    if (status !== "all") {
      conditions.push(eq(schema.donations.status, status));
    }
    
    if (period !== "all_time") {
      const today = new Date();
      
      switch (period) {
        case "this_month": {
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          conditions.push(gte(schema.donations.createdAt, firstDayOfMonth));
          break;
        }
        case "last_month": {
          const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const firstDayOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          conditions.push(gte(schema.donations.createdAt, firstDayOfLastMonth));
          conditions.push(lt(schema.donations.createdAt, firstDayOfThisMonth));
          break;
        }
        case "this_year": {
          const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
          conditions.push(gte(schema.donations.createdAt, firstDayOfYear));
          break;
        }
      }
    }
    
    let whereClause = undefined;
    if (conditions.length > 0) {
      whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    }
    
    let orderByClause: any;
    switch (sort) {
      case "id":
        orderByClause = direction === "asc" ? schema.donations.id : desc(schema.donations.id);
        break;
      case "amount":
        orderByClause = direction === "asc" ? schema.donations.amount : desc(schema.donations.amount);
        break;
      case "date":
      default:
        orderByClause = direction === "asc" ? schema.donations.createdAt : desc(schema.donations.createdAt);
        break;
    }
    
    // Join with users table to get names and emails
    const donationsWithUsers = await db.select({
      id: schema.donations.id,
      userId: schema.donations.userId,
      userName: schema.users.name,
      userEmail: schema.users.email,
      amount: schema.donations.amount,
      paymentMethod: schema.donations.paymentMethod,
      transactionId: schema.donations.transactionId,
      qrImageUrl: schema.donations.qrImageUrl,
      esewaReference: schema.donations.esewaReference,
      status: schema.donations.status,
      createdAt: schema.donations.createdAt
    })
    .from(schema.donations)
    .innerJoin(schema.users, eq(schema.donations.userId, schema.users.id))
    .where(whereClause || sql`1=1`)
    .orderBy(orderByClause)
    .limit(perPage)
    .offset(offset);
    
    const totalResults = await db.select({ count: count() })
      .from(schema.donations)
      .where(whereClause || sql`1=1`)
      .execute();
    
    return {
      donations: donationsWithUsers,
      total: totalResults[0]?.count || 0
    };
  },
  
  getTotalDonationAmount: async () => {
    const result = await db.select({ total: sum(schema.donations.amount) })
      .from(schema.donations)
      .where(eq(schema.donations.status, "completed"))
      .execute();
    
    return parseFloat(result[0]?.total || "0");
  },
  
  getMonthlyDonationAmount: async () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const result = await db.select({ total: sum(schema.donations.amount) })
      .from(schema.donations)
      .where(
        and(
          eq(schema.donations.status, "completed"),
          gte(schema.donations.createdAt, firstDayOfMonth)
        )
      )
      .execute();
    
    return parseFloat(result[0]?.total || "0");
  },
  
  getDonationGrowthPercentage: async () => {
    const today = new Date();
    
    // Current month
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Previous month
    const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    // Current month donations
    const currentMonthResult = await db.select({ total: sum(schema.donations.amount) })
      .from(schema.donations)
      .where(
        and(
          eq(schema.donations.status, "completed"),
          gte(schema.donations.createdAt, firstDayOfMonth)
        )
      )
      .execute();
    
    // Previous month donations
    const previousMonthResult = await db.select({ total: sum(schema.donations.amount) })
      .from(schema.donations)
      .where(
        and(
          eq(schema.donations.status, "completed"),
          gte(schema.donations.createdAt, firstDayOfLastMonth),
          lt(schema.donations.createdAt, firstDayOfMonth)
        )
      )
      .execute();
    
    const currentAmount = parseFloat(currentMonthResult[0]?.total || "0");
    const previousAmount = parseFloat(previousMonthResult[0]?.total || "0");
    
    if (previousAmount === 0) {
      return currentAmount > 0 ? 100 : 0;
    }
    
    return Math.round(((currentAmount - previousAmount) / previousAmount) * 100);
  },
  
  getDonationSummary: async (period = "all_time") => {
    const today = new Date();
    let startDate: Date | null = null;
    
    switch (period) {
      case "this_month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case "last_month": {
        const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const firstDayOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate = firstDayOfLastMonth;
        break;
      }
      case "this_year":
        startDate = new Date(today.getFullYear(), 0, 1);
        break;
      case "all_time":
      default:
        // Leave startDate as null for all-time queries
        break;
    }
    
    let whereClause = eq(schema.donations.status, "completed");
    if (startDate) {
      whereClause = and(whereClause, gte(schema.donations.createdAt, startDate));
    }
    
    // Total donations
    const totalResult = await db.select({ total: sum(schema.donations.amount) })
      .from(schema.donations)
      .where(whereClause)
      .execute();
    
    // Monthly total already calculated in getMonthlyDonationAmount
    const monthlyTotal = await this.getMonthlyDonationAmount();
    
    // Average donation
    const avgResult = await db
      .select({
        avg: sql`avg(${schema.donations.amount})`
      })
      .from(schema.donations)
      .where(whereClause)
      .execute();
    
    // Donation growth percentage already calculated in getDonationGrowthPercentage
    const donationGrowth = await this.getDonationGrowthPercentage();
    
    // Total donors (distinct user count)
    const donorsResult = await db
      .select({
        count: sql`count(distinct ${schema.donations.userId})`
      })
      .from(schema.donations)
      .where(whereClause)
      .execute();
    
    // Status breakdown
    const statusResults = await db
      .select({
        status: schema.donations.status,
        count: count()
      })
      .from(schema.donations)
      .groupBy(schema.donations.status)
      .execute();
    
    const statusBreakdown = statusResults.map(item => ({
      name: item.status,
      value: Number(item.count)
    }));
    
    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(today.getMonth() - 5);
    
    // Calculate the first day of each month for the last 6 months
    const months = [];
    for (let i = 0; i < 6; i++) {
      const month = new Date(today);
      month.setMonth(month.getMonth() - i);
      month.setDate(1);
      month.setHours(0, 0, 0, 0);
      months.unshift(month);
    }
    
    const monthlyTrend = [];
    
    for (let i = 0; i < months.length; i++) {
      const currentMonth = months[i];
      
      // For the last month, use today as the end date. Otherwise, use the first day of the next month.
      const endDate = i === months.length - 1 
        ? new Date(today) 
        : new Date(months[i + 1]);
      
      const monthlyResult = await db
        .select({
          total: sum(schema.donations.amount)
        })
        .from(schema.donations)
        .where(
          and(
            eq(schema.donations.status, "completed"),
            gte(schema.donations.createdAt, currentMonth),
            lt(schema.donations.createdAt, endDate)
          )
        )
        .execute();
      
      const monthName = currentMonth.toLocaleString('default', { month: 'short' });
      const year = currentMonth.getFullYear();
      const formattedMonth = `${monthName} ${year}`;
      
      monthlyTrend.push({
        month: formattedMonth,
        amount: parseFloat(monthlyResult[0]?.total || "0")
      });
    }
    
    // Payment method breakdown
    const methodResults = await db
      .select({
        method: schema.donations.paymentMethod,
        count: count()
      })
      .from(schema.donations)
      .where(whereClause)
      .groupBy(schema.donations.paymentMethod)
      .execute();
    
    const paymentMethodBreakdown = methodResults.map(item => ({
      name: item.method.replace('_', ' '),
      value: Number(item.count)
    }));
    
    return {
      totalDonations: parseFloat(totalResult[0]?.total || "0"),
      monthlyTotal,
      averageDonation: parseFloat(avgResult[0]?.avg || "0"),
      donationGrowth,
      totalDonors: Number(donorsResult[0]?.count || 0),
      statusBreakdown,
      monthlyTrend,
      paymentMethodBreakdown
    };
  },
  
  // Media operations
  createMedia: async (mediaData: Omit<schema.InsertMedia, "id">) => {
    return await db.insert(schema.media).values(mediaData).returning();
  },
  
  getMediaById: async (id: number) => {
    return await db.query.media.findFirst({
      where: eq(schema.media.id, id),
      with: {
        uploader: true
      }
    });
  },
  
  updateMedia: async (id: number, mediaData: Partial<schema.Media>) => {
    return await db.update(schema.media)
      .set(mediaData)
      .where(eq(schema.media.id, id))
      .returning();
  },
  
  deleteMedia: async (id: number) => {
    return await db.delete(schema.media)
      .where(eq(schema.media.id, id))
      .returning();
  },
  
  getAllMedia: async (page = 1, perPage = 12, search = "", type = "all") => {
    const offset = (page - 1) * perPage;
    
    let conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(schema.media.title, `%${search}%`),
          like(schema.media.description, `%${search}%`)
        )
      );
    }
    
    if (type !== "all") {
      conditions.push(eq(schema.media.type, type));
    }
    
    let whereClause = undefined;
    if (conditions.length > 0) {
      whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    }
    
    const media = await db.query.media.findMany({
      where: whereClause,
      limit: perPage,
      offset,
      orderBy: desc(schema.media.createdAt),
      with: {
        uploader: true
      }
    });
    
    const totalResults = await db.select({ count: count() })
      .from(schema.media)
      .where(whereClause || sql`1=1`)
      .execute();
    
    return {
      media: media.map(item => ({
        ...item,
        uploadedBy: item.uploader.name
      })),
      total: totalResults[0]?.count || 0
    };
  },
  
  // Event operations
  createEvent: async (eventData: Omit<schema.InsertEvent, "id">) => {
    return await db.insert(schema.events).values(eventData).returning();
  },
  
  getEventById: async (id: number) => {
    return await db.query.events.findFirst({
      where: eq(schema.events.id, id),
      with: {
        media: true
      }
    });
  },
  
  updateEvent: async (id: number, eventData: Partial<schema.Event>) => {
    return await db.update(schema.events)
      .set(eventData)
      .where(eq(schema.events.id, id))
      .returning();
  },
  
  deleteEvent: async (id: number) => {
    return await db.delete(schema.events)
      .where(eq(schema.events.id, id))
      .returning();
  },
  
  getUpcomingEvents: async (limit = 3) => {
    const now = new Date();
    
    return await db.query.events.findMany({
      where: gte(schema.events.date, now),
      limit,
      orderBy: schema.events.date,
      with: {
        media: true
      }
    });
  },
  
  getAllEvents: async (page = 1, perPage = 10) => {
    const offset = (page - 1) * perPage;
    
    const events = await db.query.events.findMany({
      limit: perPage,
      offset,
      orderBy: schema.events.date,
      with: {
        media: true
      }
    });
    
    const totalResults = await db.select({ count: count() })
      .from(schema.events)
      .execute();
    
    return {
      events: events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date.toISOString(),
        cloudinaryUrl: event.media?.cloudinaryUrl || "",
        createdAt: event.createdAt.toISOString()
      })),
      total: totalResults[0]?.count || 0
    };
  },
  
  getUpcomingEventsCount: async () => {
    const now = new Date();
    
    const result = await db.select({ count: count() })
      .from(schema.events)
      .where(gte(schema.events.date, now))
      .execute();
    
    return result[0]?.count || 0;
  },
  
  // Sermon operations
  createSermon: async (sermonData: Omit<schema.InsertSermon, "id">) => {
    return await db.insert(schema.sermons).values(sermonData).returning();
  },
  
  getSermonById: async (id: number) => {
    return await db.query.sermons.findFirst({
      where: eq(schema.sermons.id, id),
      with: {
        media: true
      }
    });
  },
  
  updateSermon: async (id: number, sermonData: Partial<schema.Sermon>) => {
    return await db.update(schema.sermons)
      .set(sermonData)
      .where(eq(schema.sermons.id, id))
      .returning();
  },
  
  deleteSermon: async (id: number) => {
    return await db.delete(schema.sermons)
      .where(eq(schema.sermons.id, id))
      .returning();
  },
  
  getLatestSermons: async (limit = 2) => {
    return await db.query.sermons.findMany({
      limit,
      orderBy: desc(schema.sermons.date),
      with: {
        media: true
      }
    });
  },
  
  getAllSermons: async (page = 1, perPage = 10, search = "", filter = "all") => {
    const offset = (page - 1) * perPage;
    
    let whereClause = undefined;
    if (search) {
      whereClause = or(
        like(schema.sermons.title, `%${search}%`),
        like(schema.sermons.description, `%${search}%`)
      );
    }
    
    // For future implementation of filters
    // if (filter !== "all") {
    //   // Add filter logic here if needed
    // }
    
    const sermons = await db.query.sermons.findMany({
      where: whereClause,
      limit: perPage,
      offset,
      orderBy: desc(schema.sermons.date),
      with: {
        media: true
      }
    });
    
    const totalResults = await db.select({ count: count() })
      .from(schema.sermons)
      .where(whereClause || sql`1=1`)
      .execute();
    
    return {
      sermons: sermons.map(sermon => ({
        id: sermon.id,
        title: sermon.title,
        description: sermon.description,
        date: sermon.date.toISOString(),
        cloudinaryUrl: sermon.media.cloudinaryUrl,
        duration: sermon.duration,
        createdAt: sermon.createdAt.toISOString()
      })),
      total: totalResults[0]?.count || 0
    };
  },
  
  // Activity operations
  logActivity: async (activityData: Omit<schema.InsertActivity, "id">) => {
    return await db.insert(schema.activities).values(activityData).returning();
  },
  
  getActivityById: async (id: number) => {
    return await db.query.activities.findFirst({
      where: eq(schema.activities.id, id),
      with: {
        user: true
      }
    });
  },
  
  getAllActivities: async (page = 1, perPage = 15, search = "", action = "all", period = "all_time", sort = "date", direction = "desc") => {
    const offset = (page - 1) * perPage;
    
    let conditions = [];
    
    if (search) {
      // Find users matching the search term
      const users = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(
          or(
            like(schema.users.name, `%${search}%`),
            like(schema.users.email, `%${search}%`)
          )
        );
      
      const userIds = users.map(u => u.id);
      
      conditions.push(
        or(
          like(schema.activities.details, `%${search}%`),
          ...(userIds.length > 0 ? [sql`${schema.activities.userId} IN (${userIds.join(',')})` as any] : [])
        )
      );
    }
    
    if (action !== "all") {
      conditions.push(eq(schema.activities.action, action));
    }
    
    if (period !== "all_time") {
      const today = new Date();
      
      switch (period) {
        case "today": {
          const startOfDay = new Date(today);
          startOfDay.setHours(0, 0, 0, 0);
          conditions.push(gte(schema.activities.createdAt, startOfDay));
          break;
        }
        case "this_week": {
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay()); // Start of current week (Sunday)
          startOfWeek.setHours(0, 0, 0, 0);
          conditions.push(gte(schema.activities.createdAt, startOfWeek));
          break;
        }
        case "this_month": {
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          conditions.push(gte(schema.activities.createdAt, startOfMonth));
          break;
        }
        case "last_month": {
          const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          conditions.push(gte(schema.activities.createdAt, startOfLastMonth));
          conditions.push(lt(schema.activities.createdAt, startOfThisMonth));
          break;
        }
      }
    }
    
    let whereClause = undefined;
    if (conditions.length > 0) {
      whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
    }
    
    let orderByClause: any;
    switch (sort) {
      case "id":
        orderByClause = direction === "asc" ? schema.activities.id : desc(schema.activities.id);
        break;
      case "action":
        orderByClause = direction === "asc" ? schema.activities.action : desc(schema.activities.action);
        break;
      case "date":
      default:
        orderByClause = direction === "asc" ? schema.activities.createdAt : desc(schema.activities.createdAt);
        break;
    }
    
    // Join with users table to get names and emails
    const activitiesWithUsers = await db.select({
      id: schema.activities.id,
      userId: schema.activities.userId,
      userName: schema.users.name,
      userEmail: schema.users.email,
      action: schema.activities.action,
      details: schema.activities.details,
      createdAt: schema.activities.createdAt
    })
    .from(schema.activities)
    .leftJoin(schema.users, eq(schema.activities.userId, schema.users.id))
    .where(whereClause || sql`1=1`)
    .orderBy(orderByClause)
    .limit(perPage)
    .offset(offset);
    
    const totalResults = await db.select({ count: count() })
      .from(schema.activities)
      .where(whereClause || sql`1=1`)
      .execute();
    
    return {
      activities: activitiesWithUsers,
      total: totalResults[0]?.count || 0
    };
  }
};
