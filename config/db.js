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
  host: '195.201.175.72',
  user: 'kpremote',
  port: '3306',
  password: 'z*4QO2HFfEsR4YM%',
  database: 'testmarketing',
  timezone: 'Z', // "Z" means UTC
  waitForConnections: true,
  connectionLimit: 10,   // adjust based on load
  queueLimit: 0
});

// Force UTC for MySQL session too
pool.on('connection', function (connection) {
  connection.query("SET time_zone = '+00:00'");
});
