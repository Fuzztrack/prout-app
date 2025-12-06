"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
exports.supabase = (0, supabase_js_1.createClient)('https://utfwujyymaikraaigvuv.supabase.co', "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Znd1anl5bWFpa3JhYWlndnV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODkwNzAsImV4cCI6MjA3ODc2NTA3MH0.d6MLGOsvTlxJDARH64D1u4kJHxKAlfX1FLegrWVE-Is");
