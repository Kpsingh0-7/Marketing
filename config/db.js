import mysql from 'mysql2/promise';
export const pool = mysql.createPool({
 host: 'localhost', // replace with your DB host
 user: 'root', // replace with your DB user
 password: 'Kpsingh@1234', // replace with your DB password
 database: 'Marketing' // replace with your DB name
});

// import mysql from "mysql2/promise";

// export const pool = mysql.createPool({
//   host: "metro.proxy.rlwy.net",
//   port: 36878,
//   user: "root",
//   password: "uHJEthyFZBfoyySYikFaIEjguNdxUDZC",
//   database: "railway",
// });

// import mysql from "mysql2/promise";

// export const pool = mysql.createPool({ 
  
//  host: '195.201.175.72', // replace with your DB host 
//  user: 'kpremote', // replace with your DB user 
//  port: '3306',
//  password: 'z*4QO2HFfEsR4YM%', // replace with your DB password 
//  database: 'gupshup' // replace with your DB name 
// });