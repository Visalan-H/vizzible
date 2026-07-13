require('dotenv').config();
const mongoose = require('mongoose');async function migrate() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/heatmap';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const oldCollectionName = 'dailyactivities';
  const backupCollectionName = `dailyactivities_backup_${Date.now()}`;
  const newCollectionName = 'dailyactivities_new';

  console.log(`Checking for old data in ${oldCollectionName}...`);
  const collections = await db.listCollections({ name: oldCollectionName }).toArray();
  if (collections.length === 0) {
      console.log(`Collection ${oldCollectionName} does not exist. Nothing to migrate.`);
      process.exit(0);
  }

  const oldDocsCount = await db.collection(oldCollectionName).countDocuments();
  if (oldDocsCount === 0) {
    console.log('No documents found to migrate.');
    process.exit(0);
  }

  // Check if already migrated
  const sample = await db.collection(oldCollectionName).findOne({});
  if (sample.year && sample.counts) {
    console.log('Data is already in the new format.');
    process.exit(0);
  }

  console.log(`Migrating ${oldDocsCount} documents...`);

  const cursor = db.collection(oldCollectionName).find({});
  
  // Group by userId -> platform -> year
  const grouped = {};
  
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc.date || doc.count === undefined) continue;

    const [yearStr, monthStr, dayStr] = doc.date.split('-');
    const year = parseInt(yearStr, 10);
    const mmdd = `${monthStr}-${dayStr}`;

    const key = `${doc.userId}_${doc.platform}_${year}`;
    if (!grouped[key]) {
      grouped[key] = {
        userId: doc.userId,
        platform: doc.platform,
        year: year,
        counts: {}
      };
    }
    grouped[key].counts[mmdd] = doc.count;
  }

  const newDocs = Object.values(grouped);
  console.log(`Grouped into ${newDocs.length} new documents. Inserting to ${newCollectionName}...`);

  if (newDocs.length > 0) {
    // Drop the new collection if it already exists from a failed run
    try {
        await db.collection(newCollectionName).drop();
    } catch (e) {
        // Ignore if it doesn't exist
    }
    await db.collection(newCollectionName).insertMany(newDocs);
  }

  console.log(`Renaming ${oldCollectionName} to ${backupCollectionName}...`);
  await db.collection(oldCollectionName).rename(backupCollectionName);

  console.log(`Renaming ${newCollectionName} to ${oldCollectionName}...`);
  await db.collection(newCollectionName).rename(oldCollectionName);

  console.log('Building indexes...');
  const DailyActivity = require('../models/DailyActivity');
  await DailyActivity.init();

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
