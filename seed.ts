import { db } from "./index";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seed() {
  try {
    console.log("🌱 Starting database seeding...");

    // Create the owner account (if it doesn't exist)
    const ownerEmail = "admin@gracechurch.org";
    const existingOwner = await db.query.users.findFirst({
      where: eq(schema.users.email, ownerEmail)
    });

    if (!existingOwner) {
      console.log("Creating owner account...");
      
      const hashedPassword = await bcrypt.hash("password123", 10);
      
      await db.insert(schema.users).values({
        name: "Admin User",
        email: ownerEmail,
        password: hashedPassword,
        role: "owner",
        status: "active",
        notificationOptIn: true,
        createdAt: new Date()
      });
      
      console.log("Owner account created successfully.");
    } else {
      console.log("Owner account already exists, skipping creation.");
    }

    // Create some sample users
    const existingUsers = await db.query.users.findMany();
    if (existingUsers.length <= 1) {
      console.log("Creating sample users...");
      
      const sampleUsers = [
        {
          name: "Jane Doe",
          email: "jane.doe@example.com",
          password: await bcrypt.hash("password123", 10),
          role: "user",
          status: "active",
          notificationOptIn: true
        },
        {
          name: "Michael Smith",
          email: "michael.smith@example.com",
          password: await bcrypt.hash("password123", 10),
          role: "user",
          status: "inactive",
          notificationOptIn: false
        },
        {
          name: "Sarah Williams",
          email: "sarah.williams@example.com",
          password: await bcrypt.hash("password123", 10),
          role: "user",
          status: "active",
          notificationOptIn: true
        }
      ];
      
      for (const user of sampleUsers) {
        await db.insert(schema.users).values(user);
      }
      
      console.log(`${sampleUsers.length} sample users created successfully.`);
    } else {
      console.log("Users already exist, skipping creation.");
    }

    // Create sample media
    const existingMedia = await db.query.media.findMany();
    if (existingMedia.length === 0) {
      console.log("Creating sample media...");
      
      // Get the first user (owner) for uploadedBy
      const uploadUser = await db.query.users.findFirst({
        where: eq(schema.users.email, ownerEmail)
      });
      
      if (!uploadUser) {
        throw new Error("Cannot find owner user for media uploads");
      }
      
      const sampleMedia = [
        {
          cloudinaryUrl: "https://images.unsplash.com/photo-1529070538774-1843cb3265df",
          cloudinaryPublicId: "weekly_bible_study",
          type: "image",
          title: "Weekly Bible Study",
          description: "Join us for an evening of community Bible study as we explore the Book of Romans.",
          uploadedBy: uploadUser.id
        },
        {
          cloudinaryUrl: "https://images.unsplash.com/photo-1509222796416-4a1fef025e92",
          cloudinaryPublicId: "worship_night",
          type: "image",
          title: "Worship Night",
          description: "An evening of praise and worship. Come with an open heart ready to encounter God.",
          uploadedBy: uploadUser.id
        },
        {
          cloudinaryUrl: "https://images.unsplash.com/photo-1593113646773-028c64a8f1b8",
          cloudinaryPublicId: "community_outreach",
          type: "image",
          title: "Community Outreach",
          description: "Join us as we serve our local community through our monthly food drive and distribution.",
          uploadedBy: uploadUser.id
        },
        {
          cloudinaryUrl: "https://pixabay.com/get/g0b206088945f4f0863c4dad7cb1e26907b58f67c5c700770605f89f4f9cbf3bf9a6dec284ba894dd3e6fbd6fe482de3adff18aed1f684d949ba96c5f9b9c0ad3_1280.jpg",
          cloudinaryPublicId: "power_of_faith_sermon",
          type: "video",
          title: "The Power of Faith",
          description: "Pastor Michael Johnson explores Hebrews 11 and discusses how faith can move mountains in our lives.",
          uploadedBy: uploadUser.id
        },
        {
          cloudinaryUrl: "https://images.unsplash.com/photo-1575367439058-6096bb9cf5e2",
          cloudinaryPublicId: "finding_peace_sermon",
          type: "video",
          title: "Finding Peace in Chaos",
          description: "Pastor Sarah Williams shares insights from Philippians 4 on maintaining peace during life's storms.",
          uploadedBy: uploadUser.id
        }
      ];
      
      for (const item of sampleMedia) {
        await db.insert(schema.media).values(item);
      }
      
      console.log(`${sampleMedia.length} sample media items created successfully.`);
    } else {
      console.log("Media already exists, skipping creation.");
    }

    // Create sample events
    const existingEvents = await db.query.events.findMany();
    if (existingEvents.length === 0) {
      console.log("Creating sample events...");
      
      // Get media IDs for the events
      const bibleStudyMedia = await db.query.media.findFirst({
        where: eq(schema.media.title, "Weekly Bible Study")
      });
      
      const worshipMedia = await db.query.media.findFirst({
        where: eq(schema.media.title, "Worship Night")
      });
      
      const outreachMedia = await db.query.media.findFirst({
        where: eq(schema.media.title, "Community Outreach")
      });
      
      if (!bibleStudyMedia || !worshipMedia || !outreachMedia) {
        throw new Error("Cannot find required media for events");
      }
      
      // Create future dates for events
      const now = new Date();
      const oneWeekLater = new Date(now);
      oneWeekLater.setDate(oneWeekLater.getDate() + 7);
      
      const twoWeeksLater = new Date(now);
      twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
      
      const threeWeeksLater = new Date(now);
      threeWeeksLater.setDate(threeWeeksLater.getDate() + 21);
      
      const sampleEvents = [
        {
          title: "Weekly Bible Study",
          description: "Join us for an evening of community Bible study as we explore the Book of Romans.",
          date: oneWeekLater,
          mediaId: bibleStudyMedia.id
        },
        {
          title: "Worship Night",
          description: "An evening of praise and worship. Come with an open heart ready to encounter God.",
          date: twoWeeksLater,
          mediaId: worshipMedia.id
        },
        {
          title: "Community Outreach",
          description: "Join us as we serve our local community through our monthly food drive and distribution.",
          date: threeWeeksLater,
          mediaId: outreachMedia.id
        }
      ];
      
      for (const event of sampleEvents) {
        await db.insert(schema.events).values(event);
      }
      
      console.log(`${sampleEvents.length} sample events created successfully.`);
    } else {
      console.log("Events already exist, skipping creation.");
    }

    // Create sample sermons
    const existingSermons = await db.query.sermons.findMany();
    if (existingSermons.length === 0) {
      console.log("Creating sample sermons...");
      
      // Get media IDs for the sermons
      const faithSermonMedia = await db.query.media.findFirst({
        where: eq(schema.media.title, "The Power of Faith")
      });
      
      const peaceSermonMedia = await db.query.media.findFirst({
        where: eq(schema.media.title, "Finding Peace in Chaos")
      });
      
      if (!faithSermonMedia || !peaceSermonMedia) {
        throw new Error("Cannot find required media for sermons");
      }
      
      // Create past dates for sermons
      const now = new Date();
      
      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const twoWeeksAgo = new Date(now);
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      
      const sampleSermons = [
        {
          title: "The Power of Faith",
          description: "Pastor Michael Johnson explores Hebrews 11 and discusses how faith can move mountains in our lives.",
          date: oneWeekAgo,
          mediaId: faithSermonMedia.id,
          duration: "34:28"
        },
        {
          title: "Finding Peace in Chaos",
          description: "Pastor Sarah Williams shares insights from Philippians 4 on maintaining peace during life's storms.",
          date: twoWeeksAgo,
          mediaId: peaceSermonMedia.id,
          duration: "41:15"
        }
      ];
      
      for (const sermon of sampleSermons) {
        await db.insert(schema.sermons).values(sermon);
      }
      
      console.log(`${sampleSermons.length} sample sermons created successfully.`);
    } else {
      console.log("Sermons already exist, skipping creation.");
    }

    // Create sample contacts
    const existingContacts = await db.query.contacts.findMany();
    if (existingContacts.length === 0) {
      console.log("Creating sample contacts...");
      
      const sampleContacts = [
        {
          name: "John Smith",
          email: "john.smith@example.com",
          message: "I'm interested in learning more about the upcoming Bible study. What time does it start?",
          status: "read"
        },
        {
          name: "Emily Johnson",
          email: "emily.johnson@example.com",
          message: "Hello! I'm new to the area and looking for a church community. Do you have any newcomer events?",
          status: "unread"
        },
        {
          name: "Robert Davis",
          email: "robert.davis@example.com",
          message: "I'd like to volunteer for the community outreach program. How can I get involved?",
          status: "responded",
          responseMessage: "Thank you for your interest in volunteering! We'd love to have you join us. Our next volunteer orientation is this Sunday after the service. Please come to the fellowship hall at 12:30pm.",
          responseDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
        }
      ];
      
      for (const contact of sampleContacts) {
        await db.insert(schema.contacts).values(contact);
      }
      
      console.log(`${sampleContacts.length} sample contacts created successfully.`);
    } else {
      console.log("Contacts already exist, skipping creation.");
    }

    // Create sample donations
    const existingDonations = await db.query.donations.findMany();
    if (existingDonations.length === 0) {
      console.log("Creating sample donations...");
      
      // Get some user IDs for the donations
      const users = await db.query.users.findMany();
      
      if (users.length < 2) {
        throw new Error("Not enough users for sample donations");
      }
      
      // Create past dates for donations
      const now = new Date();
      
      const oneDayAgo = new Date(now);
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const sampleDonations = [
        {
          userId: users[1].id,
          amount: "50.00",
          paymentMethod: "credit_card",
          status: "completed",
          createdAt: oneDayAgo
        },
        {
          userId: users[2].id,
          amount: "100.00",
          paymentMethod: "paypal",
          status: "completed",
          createdAt: twoDaysAgo
        },
        {
          userId: users[1].id,
          amount: "25.00",
          paymentMethod: "debit_card",
          status: "pending",
          createdAt: threeDaysAgo
        }
      ];
      
      for (const donation of sampleDonations) {
        await db.insert(schema.donations).values(donation);
      }
      
      console.log(`${sampleDonations.length} sample donations created successfully.`);
    } else {
      console.log("Donations already exist, skipping creation.");
    }

    // Create sample activities
    const existingActivities = await db.query.activities.findMany();
    if (existingActivities.length === 0) {
      console.log("Creating sample activities...");
      
      // Get user IDs for activities
      const users = await db.query.users.findMany();
      
      // Create past dates for activities
      const now = new Date();
      
      const oneHourAgo = new Date(now);
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const twoHoursAgo = new Date(now);
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
      
      const threeHoursAgo = new Date(now);
      threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);
      
      const fourHoursAgo = new Date(now);
      fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);
      
      const fiveHoursAgo = new Date(now);
      fiveHoursAgo.setHours(fiveHoursAgo.getHours() - 5);
      
      const sampleActivities = [
        {
          userId: users[0].id,
          action: "login",
          details: `User ${users[0].name} logged in`,
          createdAt: oneHourAgo
        },
        {
          userId: users[1].id,
          action: "login",
          details: `User ${users[1].name} logged in`,
          createdAt: twoHoursAgo
        },
        {
          userId: users[0].id,
          action: "media_upload",
          details: `User ${users[0].name} uploaded a new image: "Weekly Bible Study"`,
          createdAt: threeHoursAgo
        },
        {
          userId: users[1].id,
          action: "donation",
          details: `User ${users[1].name} made a donation of $50.00`,
          createdAt: fourHoursAgo
        },
        {
          userId: users[2].id,
          action: "signup",
          details: `User ${users[2].name} created an account`,
          createdAt: fiveHoursAgo
        }
      ];
      
      for (const activity of sampleActivities) {
        await db.insert(schema.activities).values(activity);
      }
      
      console.log(`${sampleActivities.length} sample activities created successfully.`);
    } else {
      console.log("Activities already exist, skipping creation.");
    }

    console.log("🌱 Database seeding completed successfully.");
  }
  catch (error) {
    console.error("❌ Error seeding database:", error);
  }
}

seed();
