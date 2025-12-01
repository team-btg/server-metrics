import React from 'react';
import { Github } from 'lucide-react';  
const AppFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-4 px-6 text-center text-gray-500 text-sm">
      <p>
        &copy; {currentYear} Server Metrics. Made with ❤️ by [team-btg].
      </p>
      <div className="flex justify-center space-x-4 mt-2">
        <a href="https://github.com/team-btg" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-300">
          <Github size={20} />
        </a>
      </div>
    </footer>
  );
};

export default AppFooter;