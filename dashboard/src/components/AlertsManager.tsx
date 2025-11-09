import React, { useState, useEffect } from 'react';
import { X, Edit, Trash2 } from 'lucide-react';

// Update the interface
interface AlertRule {
  id: number;
  name: string; // <-- Add name
  metric: 'cpu' | 'memory' | 'disk';
  operator: '>' | '<';
  threshold: number;
  duration_minutes: number;
  is_enabled: boolean;
}

interface AlertsManagerProps {
  serverId: string;
  token: string;
}

const AlertsManager: React.FC<AlertsManagerProps> = ({ serverId, token }) => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  useEffect(() => {
    const fetchRules = async () => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`http://localhost:8000/api/v1/alerts/servers/${serverId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch rules.');
        const data = await response.json();  
        setRules(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRules();
  }, [serverId, token]);

  const handleOpenCreateModal = () => {
    setEditingRule(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: AlertRule) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const handleRuleSaved = (savedRule: AlertRule) => {
    if (editingRule) {
      setRules(rules.map(r => r.id === savedRule.id ? savedRule : r));
    } else {
      setRules([...rules, savedRule]);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:8000/api/v1/alerts/${ruleId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Failed to delete rule.');
      }
      setRules(rules.filter(r => r.id !== ruleId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-white">Alert Rules</h3>
        <button 
          onClick={handleOpenCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          Create New Rule
        </button>
      </div>
      <p className="text-gray-400 mb-6">
        Create rules to be notified when a server's metrics cross a defined threshold for a specific duration.
      </p>
      
      {isLoading && <p>Loading rules...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      {!isLoading && !error && (
        <div className="space-y-3">
          {rules.length > 0 ? (
            rules.map(rule => (
              <div key={rule.id} className="bg-gray-900 p-4 rounded-lg flex justify-between items-center">
                <div>
                  {/* Display the rule name */}
                  <p className="text-white font-semibold">{rule.name}</p>
                  <div className="flex items-center text-sm text-gray-400 mt-1">
                    <span className="font-mono uppercase bg-gray-700 text-white text-xs font-bold mr-2 px-2.5 py-0.5 rounded">{rule.metric}</span>
                    <span>{rule.operator} {rule.threshold}%</span>
                    <span className="ml-2">for {rule.duration_minutes} min</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={() => handleOpenEditModal(rule)} className="bg-transparent text-gray-400 text-blue-400"><Edit size={18} /></button>
                  <button onClick={() => handleDeleteRule(rule.id)} className="bg-transparent text-gray-400 text-red-500"><Trash2 size={18} /></button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 px-4 border-2 border-dashed border-gray-700 rounded-lg">
              <p className="text-gray-400">No alert rules have been created for this server yet.</p>
            </div>
          )}
        </div>
      )}
      
      {isModalOpen && (
        <RuleFormModal
          serverId={serverId}
          token={token}
          existingRule={editingRule}
          onClose={() => setIsModalOpen(false)}
          onRuleSaved={handleRuleSaved}
        />
      )}
    </div>
  );
};

// --- Renamed and updated Component: RuleFormModal ---
interface RuleFormModalProps {
  serverId: string;
  token: string;
  existingRule: AlertRule | null; // Can be null for creation
  onClose: () => void;
  onRuleSaved: (newRule: AlertRule) => void;
}

const RuleFormModal: React.FC<RuleFormModalProps> = ({ serverId, token, existingRule, onClose, onRuleSaved }) => {
  const [name, setName] = useState(existingRule?.name || ''); // <-- Add state for name
  const [metric, setMetric] = useState(existingRule?.metric || 'cpu');
  const [operator, setOperator] = useState(existingRule?.operator || '>');
  const [threshold, setThreshold] = useState(existingRule?.threshold || 80);
  const [duration, setDuration] = useState(existingRule?.duration_minutes || 5);
  const [isEnabled, setIsEnabled] = useState(existingRule?.is_enabled || false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = existingRule !== null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const ruleData = { name, metric, operator, threshold, duration_minutes: duration, is_enabled: isEnabled };
    const url = isEditing ? `http://localhost:8000/api/v1/alerts/${existingRule.id}` : `http://localhost:8000/api/v1/alerts/servers/${serverId}`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(ruleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Failed to ${isEditing ? 'update' : 'create'} rule.`);
      }

      const savedRule = await response.json();
      onRuleSaved(savedRule);
      onClose();
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full relative">
        <button onClick={onClose} className="bg-transparent absolute top-4 right-4 text-gray-400 text-white"><X size={24} /></button>
        <h2 className="text-xl font-bold mb-4 text-white">{isEditing ? 'Edit' : 'Create New'} Alert Rule</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Rule Name Input */}
            <div>
              <label htmlFor="ruleName" className="block text-sm font-medium text-gray-300">Rule Name</label>
              <input 
                type="text" 
                id="ruleName"
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
                className="mt-1 block w-full bg-gray-900 border-gray-700 rounded-md py-2 px-3 text-white" 
                placeholder="e.g., High CPU Warning"
              />
            </div>
            {/* Metric Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300">Metric</label>
              <select value={metric} onChange={e => setMetric(e.target.value as any)} className="mt-1 block w-full bg-gray-900 border-gray-700 rounded-md py-2 px-3 text-white">
                <option value="cpu">CPU Usage</option>
                <option value="memory">Memory Usage</option>
                <option value="disk">Disk Usage</option>
              </select>
            </div>
            {/* Condition Builder */}
            <div className="flex items-center space-x-2">
              <div className="w-1/3">
                <label className="block text-sm font-medium text-gray-300">Condition</label>
                <select value={operator} onChange={e => setOperator(e.target.value as any)} className="mt-1 block w-full bg-gray-900 border-gray-700 rounded-md py-2 px-3 text-white">
                  <option value=">">Greater Than</option>
                  <option value="<">Less Than</option>
                </select>
              </div>
              <div className="w-2/3">
                <label className="block text-sm font-medium text-gray-300">Threshold (%)</label>
                <input type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="mt-1 block w-full bg-gray-900 border-gray-700 rounded-md py-2 px-3 text-white" />
              </div>
            </div>
            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-300">Duration (minutes)</label>
              <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="mt-1 block w-full bg-gray-900 border-gray-700 rounded-md py-2 px-3 text-white" />
              <p className="text-xs text-gray-500 mt-1">The condition must be met for this many minutes to trigger an alert.</p>
            </div>
            <div className="flex items-center space-x-2"> 
              <input type="checkbox" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} className="mt-1 block h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <label className="block text-sm font-medium text-gray-300">Enable</label>
            </div>
          </div>
          {submitError && <p className="mt-4 text-sm text-red-500">{submitError}</p>}
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50">
              {isEditing ? isSubmitting ? 'Updating...' : 'Update Rule' : isSubmitting ? 'Creating...' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AlertsManager;