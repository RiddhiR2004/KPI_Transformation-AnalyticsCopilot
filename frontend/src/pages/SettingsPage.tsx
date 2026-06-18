import React, { useState, useEffect } from "react";
import { Settings, Monitor, FileText, User } from "lucide-react";
import { api } from "../lib/api";

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("application");
  
  // Form states
  const [displayName, setDisplayName] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [theme, setTheme] = useState("dark");
  const [exportFormat, setExportFormat] = useState("pdf");
  const [namingConvention, setNamingConvention] = useState("[CLIENTCODE]_[ENGID]_[DATE]");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    // Load values from localStorage on mount
    setDisplayName(localStorage.getItem("user_name") || "riddhi.r");
    setEmailAddress(localStorage.getItem("user_email") || "riddhi.r@example.com");
    setTheme(localStorage.getItem("settings_theme") || "dark");
    setExportFormat(localStorage.getItem("settings_export_format") || "pdf");
    setNamingConvention(localStorage.getItem("settings_naming_convention") || "[CLIENTCODE]_[ENGID]_[DATE]");
  }, []);

  const handleSave = async () => {
    setSuccess("");
    setError("");
    try {
      const oldName = localStorage.getItem("user_name") || "riddhi.r";
      const oldEmail = localStorage.getItem("user_email") || "riddhi.r@example.com";

      // Save to local storage
      localStorage.setItem("user_name", displayName.trim());
      localStorage.setItem("user_email", emailAddress.trim());
      localStorage.setItem("settings_theme", theme);
      localStorage.setItem("settings_export_format", exportFormat);
      localStorage.setItem("settings_naming_convention", namingConvention);

      // Audit log the user profile changes
      await api.logAuditEvent({
        module: "User Management",
        action: "Update",
        status: "Success",
        entity_type: "User",
        entity_name: displayName.trim(),
        previous_value: JSON.stringify({ name: oldName, email: oldEmail }),
        new_value: JSON.stringify({ name: displayName.trim(), email: emailAddress.trim() })
      });

      // Audit log settings updates
      await api.logAuditEvent({
        module: "Settings",
        action: "Update",
        status: "Success",
        entity_type: "Settings",
        entity_name: "Application Preferences",
        new_value: JSON.stringify({
          theme,
          exportFormat,
          namingConvention
        })
      });

      setSuccess("Preferences saved successfully!");
      
      // Reload window to update the Shell header user profile details
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "application":
        return (
          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5] border-b border-[#303030] pb-3">
              Application Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Theme</label>
                <select 
                  className="field w-1/2" 
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="system">System Default</option>
                  <option value="dark">Dark Mode</option>
                  <option value="light">Light Mode</option>
                </select>
                <p className="text-[11px] text-[#666] mt-1">Platform theme preference (future-ready).</p>
              </div>

              <div>
                <label className="label">Notification Preferences</label>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="notify-email" className="accent-[#FFE600] h-4 w-4" defaultChecked />
                  <label htmlFor="notify-email" className="text-sm text-[#F5F5F5]">Email Notifications</label>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <input type="checkbox" id="notify-app" className="accent-[#FFE600] h-4 w-4" defaultChecked />
                  <label htmlFor="notify-app" className="text-sm text-[#F5F5F5]">In-App Notifications</label>
                </div>
              </div>
            </div>
          </div>
        );
      case "document":
        return (
          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5] border-b border-[#303030] pb-3">
              Document Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Default Export Format</label>
                <select 
                  className="field w-1/2"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                >
                  <option value="pdf">PDF Document (.pdf)</option>
                  <option value="docx">Word Document (.docx)</option>
                  <option value="xlsx">Excel Spreadsheet (.xlsx)</option>
                  <option value="json">JSON Data (.json)</option>
                </select>
              </div>
              <div>
                <label className="label">Document Naming Convention</label>
                <input 
                  type="text" 
                  className="field w-1/2" 
                  value={namingConvention}
                  onChange={(e) => setNamingConvention(e.target.value)}
                />
                <p className="text-[11px] text-[#666] mt-1">Tags: [CLIENTCODE], [ENGID], [DATE], [DOCTYPE]</p>
              </div>
            </div>
          </div>
        );
      case "user":
        return (
          <div className="space-y-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#F5F5F5] border-b border-[#303030] pb-3">
              User Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Display Name</label>
                <input 
                  type="text" 
                  className="field w-1/2" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input 
                  type="email" 
                  className="field w-1/2" 
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Role</label>
                <input type="text" className="field w-1/2" defaultValue="Consultant" disabled />
                <p className="text-[11px] text-[#666] mt-1">Roles are managed by the platform administrator.</p>
              </div>
              <div>
                <label className="label">Display Density</label>
                <select className="field w-1/2" defaultValue="comfortable">
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="border border-[#303030] bg-[#1B1B1B] p-8 rounded-sm">
        <div className="flex items-center gap-3 mb-2">
          <Settings size={20} className="text-[#FFE600]" />
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-[#F5F5F5]">
            Platform Settings
          </h2>
        </div>
        <p className="max-w-2xl text-xs text-[#B0B0B0] leading-relaxed">
          Manage your application preferences, document settings, and user profile configuration.
        </p>
      </section>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6">
        
        {/* Navigation Sidebar */}
        <aside className="border border-[#303030] bg-[#1B1B1B] rounded-sm p-4 space-y-1 h-fit">
          <button
            onClick={() => { setActiveTab("application"); setSuccess(""); setError(""); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-semibold transition-colors ${
              activeTab === "application" ? "bg-[#111] text-[#FFE600] border border-[#303030]" : "text-[#B0B0B0] hover:bg-[#111] hover:text-[#F5F5F5]"
            }`}
          >
            <Monitor size={16} />
            Application
          </button>
          <button
            onClick={() => { setActiveTab("document"); setSuccess(""); setError(""); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-semibold transition-colors ${
              activeTab === "document" ? "bg-[#111] text-[#FFE600] border border-[#303030]" : "text-[#B0B0B0] hover:bg-[#111] hover:text-[#F5F5F5]"
            }`}
          >
            <FileText size={16} />
            Documents
          </button>
          <button
            onClick={() => { setActiveTab("user"); setSuccess(""); setError(""); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-semibold transition-colors ${
              activeTab === "user" ? "bg-[#111] text-[#FFE600] border border-[#303030]" : "text-[#B0B0B0] hover:bg-[#111] hover:text-[#F5F5F5]"
            }`}
          >
            <User size={16} />
            User Profile
          </button>
        </aside>

        {/* Content Area */}
        <main className="border border-[#303030] bg-[#1B1B1B] rounded-sm p-8">
          {renderTabContent()}
          
          <div className="mt-8 pt-6 border-t border-[#303030] flex justify-end items-center gap-4">
            {success && <span className="text-xs text-[#FFE600] font-semibold">{success}</span>}
            {error && <span className="text-xs text-red-500 font-semibold">{error}</span>}
            <button onClick={handleSave} className="button-yellow">
              Save Preferences
            </button>
          </div>
        </main>

      </div>
    </div>
  );
}
