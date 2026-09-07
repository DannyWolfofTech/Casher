import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 8080,
    watch: { ignored: ['**/.audit-results/**','**/release-artifacts/**','**/android/**','**/ios/**','**/experiments/**'] },
    fs: { deny: ['.env','.env.*','**/*.{crt,pem,p12,jks,keystore,dpapi}','**/.git/**','**/.audit-results/**','**/release-artifacts/**'] },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}));
