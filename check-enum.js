const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://crm:crm_dev_password@localhost:5432/personal_crm?schema=public' });

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT unnest(enum_range(NULL::"InteractionType"))::text AS enum_value;
  `);
  console.log("DB Enum Values:");
  res.rows.forEach(r => console.log(r.enum_value));
  await client.end();
}
run().catch(console.error);
