export default async()=>Response.json({clientId:process.env.GOOGLE_CLIENT_ID||'',configured:Boolean(process.env.GOOGLE_CLIENT_ID)},{headers:{'Cache-Control':'no-store'}});
