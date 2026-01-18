import { motion } from 'framer-motion';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 py-8 px-6 mt-auto">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500"
        >
          {/* Copyright */}
          <p className="font-body">
            &copy; {currentYear} Opendoor Technologies Inc.
          </p>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a
              href="https://www.opendoor.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-opendoor-blue transition-colors"
            >
              Terms
            </a>
            <a
              href="https://www.opendoor.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-opendoor-blue transition-colors"
            >
              Privacy
            </a>
            <a
              href="https://www.opendoor.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-opendoor-blue transition-colors"
            >
              opendoor.com
            </a>
          </div>
        </motion.div>

        {/* Disclaimer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-4 text-xs text-slate-400 text-center sm:text-left"
        >
          Images are AI-generated artistic interpretations and do not represent actual property conditions.
        </motion.p>
      </div>
    </footer>
  );
}
