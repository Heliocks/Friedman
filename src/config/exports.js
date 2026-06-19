module.exports = [
  // Reemplaza estos SELECT de ejemplo por consultas reales de tu base.
  // Usa alias para controlar los encabezados del CSV.
  {
    name: 'query1',
    filename: 'query1.csv',
    sql: `
      SELECT 
          AISEQ,
          AICANT,
          AIALMACEN 
      FROM FAXINV WHERE  AIALMACEN = '109'
    `,
  },
  {
    name: 'query2',
    filename: 'query2.csv',
    sql: `
      SELECT 
          AISEQ,
          AICANT,
          AIALMACEN 
      FROM FAXINV WHERE  AIALMACEN = '108'
    `,
  },
];
