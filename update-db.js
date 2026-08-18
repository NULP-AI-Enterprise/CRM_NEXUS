const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://crm:crm_dev_password@localhost:5432/personal_crm?schema=public' });

async function run() {
  await client.connect();
  
  await client.query(`ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'MEETING';`);
  await client.query(`ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'INTRO';`);
  await client.query(`ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'EMAIL';`);
  await client.query(`ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'WORKSHOP';`);
  await client.query(`ALTER TYPE "InteractionType" ADD VALUE IF NOT EXISTS 'MEMO';`);
  
  await client.query(`UPDATE "Interaction" SET type = 'MEETING' WHERE type = 'MEET';`);
  await client.query(`UPDATE "Interaction" SET type = 'MEMO' WHERE type = 'NOTE';`);
  await client.query(`UPDATE "Interaction" SET type = 'INTRO' WHERE type = 'OFFLINE';`);
  await client.query(`UPDATE "Interaction" SET type = 'EMAIL' WHERE type = 'ZOOM';`);
  
  console.log("Updated rows");
  await client.end();
}
run().catch(console.error);
