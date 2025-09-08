import mysql from 'mysql2/promise';

export default async function handler(req, res) {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      ssl: false
    });

    const [rows] = await connection.execute('SELECT 1 as test');
    await connection.end();
    
    return res.status(200).json({
      success: true,
      result: rows[0],
      env: {
        host: process.env.DB_HOST ? 'SET' : 'MISSING',
        user: process.env.DB_USER ? 'SET' : 'MISSING',
        password: process.env.DB_PASSWORD ? 'SET' : 'MISSING',
        database: process.env.DB_NAME ? 'SET' : 'MISSING'
      }
    });
    
  } catch (error) {
    return res.status(500).json({ 
      error: error.message,
      code: error.code,
      env: {
        host: process.env.DB_HOST ? 'SET' : 'MISSING',
        user: process.env.DB_USER ? 'SET' : 'MISSING',
        password: process.env.DB_PASSWORD ? 'SET' : 'MISSING',
        database: process.env.DB_NAME ? 'SET' : 'MISSING'
      }
    });
  }
}