import React from 'react';
import { BarChart, Server, Settings, X, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMinimized: boolean;
  setIsMinimized: React.Dispatch<React.SetStateAction<boolean>>;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, isMinimized, setIsMinimized }) => {
  const navItems = [
    { icon: <BarChart size={20} />, name: 'Dashboard' },
    { icon: <Server size={20} />, name: 'Servers' }, 
    { icon: <Settings size={20} />, name: 'Settings' },
  ];

  // Classes for the sidebar's responsive and minimized behavior
  const sidebarClasses = `
    bg-gray-800 text-white flex flex-col
    absolute inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
    md:relative md:translate-x-0 
    transition-all duration-300 ease-in-out
    z-30
    ${isMinimized ? 'md:w-20' : 'md:w-64'}
    ${!isMinimized ? 'w-64' : ''}
  `;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 bg-black opacity-50 z-20 md:hidden" onClick={() => setIsOpen(false)}></div>}

      <div className={sidebarClasses}>
        {/* Top section: Logo and mobile close */}
        <div className={`flex items-center ${isMinimized ? 'justify-center' : 'justify-between'} px-4 h-16 border-b border-gray-700`}>
          <span className={`text-white text-2xl font-extrabold ${isMinimized ? 'hidden' : 'block'}`}>Metrics</span>
          <button onClick={() => setIsOpen(false)} className="md:hidden p-1 rounded-md bg-gray-700">
            <X size={24} />
          </button>
          {/* Bottom section: Minimize button */}
          <div className="hidden md:block border-t border-gray-700">
            <button 
              onClick={() => setIsMinimized(!isMinimized)} 
              className="flex items-center justify-center w-full h-12 text-gray-400 bg-gray-700 hover:text-white"
            >
              {isMinimized ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-grow px-2 py-4 space-y-2">
          {navItems.map((item, index) => (
            <a
              key={index}
              href="#"
              className={`flex items-center space-x-3 py-2.5 px-4 rounded transition duration-200 bg-gray-700 ${index === 0 ? 'bg-gray-900' : ''} ${isMinimized ? 'justify-center' : ''}`}
              title={isMinimized ? item.name : ''}
            >
              {item.icon}
              <span className={`${isMinimized ? 'hidden' : 'block'}`}>{item.name}</span>
            </a>
          ))}
        </nav>
 
      </div>
    </>
  );
};

export default Sidebar;
