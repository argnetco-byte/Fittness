// Called inside the Sheet write lock, before reserving the ID header.
export async function ensureIdColumn(request){
 const metadata=await request('?fields=sheets.properties(sheetId,title,gridProperties.columnCount)');
 const properties=metadata.sheets?.find(s=>s.properties?.title==='Exercise Log')?.properties;
 if(!properties||!Number.isInteger(properties.gridProperties?.columnCount))throw new Error('Exercise Log grid could not be found.');
 const missing=9-properties.gridProperties.columnCount;
 if(missing>0)await request(':batchUpdate',{method:'POST',body:JSON.stringify({requests:[{appendDimension:{sheetId:properties.sheetId,dimension:'COLUMNS',length:missing}}]})});
}
