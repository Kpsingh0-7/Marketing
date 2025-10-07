// import mysql from 'mysql2/promise';
// export const pool = mysql.createPool({
//  host: 'localhost', // replace with your DB host
//  user: 'markcouk_kpsingh ', // replace with your DB user
//  password: 'Kpsingh@1234', // replace with your DB password
//  database: 'markcouk_marketing' // replace with your DB name
// });

// import mysql from "mysql2/promise";

// export const pool = mysql.createPool({
//   host: "metro.proxy.rlwy.net",
//   port: 36878,
//   user: "root",
//   password: "uHJEthyFZBfoyySYikFaIEjguNdxUDZC",
//   database: "railway",
// });

import mysql from "mysql2/promise";

export const pool = mysql.createPool({ 
  host: '192.168.1.85',
  user: 'KPSINGH',
  port: '3306',
  password: 'Kpsingh@1234',
  database: 'markcouk_marketing',
  timezone: 'Z', // "Z" means UTC
  waitForConnections: true,
  connectionLimit: 10,   // adjust based on load
  queueLimit: 0,
   charset: 'utf8mb4_general_ci'
});


// Force UTC for MySQL session too
pool.on('connection', function (connection) {
  connection.query("SET time_zone = '+00:00'");
});
