// import mysql from 'mysql2/promise';
// export const pool = mysql.createPool({
//  host: 'localhost', // replace with your DB host
//  user: 'root', // replace with your DB user
//  password: 'Kpsingh@1234', // replace with your DB password
//  database: 'gupshup' // replace with your DB name
// });

import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: "metro.proxy.rlwy.net",
  port: 36878,
  user: "root",
  password: "uHJEthyFZBfoyySYikFaIEjguNdxUDZC",
  database: "railway",
});

const createTables = async () => {
  try {
    const connection = await pool.getConnection();

    // Optionally start a transaction
    await connection.beginTransaction();

    // Each insert statement should be a separate query call
    const insertQueries = [
      `INSERT INTO food_shop (food_email_id, shop_name, first_name, last_name, email_id, password, food_shop_address_id, mobileno, shop_type, profile_image)
       VALUES
       (NULL, 'Spicy Kitchen', 'John', 'Doe', 'john@spicy.com', 'pass123', NULL, '1234567890', '1,2', NULL),
       (NULL, 'Pizza Palace', 'Jane', 'Smith', 'jane@pizza.com', 'pass234', NULL, '2345678901', '2', NULL)`,

      `INSERT INTO wp_customer_marketing (name, last_name, mobile_no, profile_image, shop_id, register_date, couponcode, user_country_code, birthday, anniversary)
       VALUES
       ('Shiv', 'Shanker', '917016761964', 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg', 1, '2024-04-01 10:00:00', 'MJ23', 'US', '1961-02-17', '1989-06-01'),
       ('Serena', 'Williams', '9990000002', 'https://images.pexels.com/photos/771742/pexels-photo-771742.jpeg', 1, '2024-04-01 11:00:00', 'SW20', 'US', '1981-09-26', '2017-11-16')`,

      `INSERT INTO whatsapp_templates (id, external_id, app_id, waba_id, element_name, category, language_code, template_type, status, data, container_meta, created_on, modified_on) VALUES
       ('41a5e9b8-2eff-4275-ba9b-d8ae275aec6e', '706639005026520', '7f97d76e-d64a-4c7b-b589-7b607dce5b45', '110171975093525', 'text1', 'marketing', 'en', 'text', 'approved',
        'FoodChow\nWelcome to Foodchow',
        '{"data":"Welcome to Foodchow","header":"FoodChow","sampleText":"Welcome to Foodchow","sampleHeader":"FoodChow","enableSample":true,"editTemplate":false,"allowTemplateCategoryChange":false,"addSecurityRecommendation":false}',
        1743767842476, 1743767872211)
      `,

      `INSERT INTO shop_template_map (shop_id, template_id) VALUES
       (1, '41a5e9b8-2eff-4275-ba9b-d8ae275aec6e');`,

      `INSERT INTO gupshup_configuration (shop_id, gupshup_id) VALUES (1, '7f97d76e-d64a-4c7b-b589-7b607dce5b45')`
    ];

    for (const query of insertQueries) {
      await connection.query(query);
    }

    // Commit the transaction
    await connection.commit();

    console.log("✅ Sample data inserted successfully.");
    connection.release();
  } catch (error) {
    console.error("❌ Error creating tables:", error.message);
  }
};

createTables();
