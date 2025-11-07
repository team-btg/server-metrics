import React from 'react';
import { BarChart, Server, Settings, X, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMinimized: boolean;
  setIsMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  children: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, isMinimized, setIsMinimized, children }) => {
  // Classes for the sidebar's responsive and minimized behavior
  const sidebarClasses = `
    bg-gray-800 text-white flex flex-col
    absolute inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
    md:relative md:translate-x-0 
    transition-all duration-300 ease-in-out
    z-30
    ${isMinimized ? 'md:w-20' : 'md:w-46'}
    ${!isMinimized ? 'w-46' : ''}
  `;

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="fixed inset-0 bg-black opacity-50 z-20 md:hidden" onClick={() => setIsOpen(false)}></div>}

      <div className={sidebarClasses}>
        {/* Top section: Logo and mobile close */}
        <div className={`flex items-center ${isMinimized ? 'justify-center' : 'justify-between'} px-4 h-16 border-b border-gray-700`}>
          <span className={`text-white text-2xl font-extrabold ${isMinimized ? 'hidden' : 'block'}`}>Metrics</span>
          {/* Mobile close button with transparent background */}
          <button onClick={() => setIsOpen(false)} className="md:hidden p-1 rounded-md bg-transparent text-gray-400 hover:text-white focus:outline-none">
            <X size={24} />
          </button> 
          <div className="hidden md:block border-gray-700">
            <button 
              onClick={() => setIsMinimized(!isMinimized)} 
              className="bg-transparent p-1 rounded-full text-gray-400 hover:text-white focus:outline-none" 
            >
              {isMinimized ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        {children}
      </div>
    </>
  );
};

export default Sidebar;
