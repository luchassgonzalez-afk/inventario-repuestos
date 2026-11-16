// Datos públicos del proyecto de Supabase (la "anon key" está pensada para ir en el navegador:
// los datos los protege el login). NUNCA pongas acá la service_role key ni la clave de Anthropic.
window.APP_CONFIG = {
  SUPABASE_URL: "https://mrcxsjdymnlfbwqdycmt.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yY3hzamR5bW5sZmJ3cWR5Y210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MDE1OTgsImV4cCI6MjExMDI3NzU5OH0.YU6lcXDAuCSys_Z9BwodQZJtiZhZzu5xMU3tEVGvTgg",
  // Dominio de los usuarios: escribiendo "lucas" se entra como lucas@avanor.com. También se puede escribir el mail completo. No se manda ningún mail.
  DOMINIO_USUARIOS: "avanor.com",
};
