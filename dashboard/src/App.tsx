import './App.css'
import React from "react";
import { MainTabs } from "./components/MainTabs";

const App: React.FC = () => {
  const serverId = "ad8e5685-837b-48a6-b888-c116b66cac79"; // replace with actual server_id
  const token = ""; // optional JWT token if required

  return (
    <div className="min-h-screen bg-gray-100">
      <MainTabs serverId={serverId} token={token} />
    </div>
  );
};

export default App;
