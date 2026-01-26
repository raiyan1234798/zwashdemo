import React, { useEffect, useState } from 'react';
import { ROLES, PERMISSIONS } from '../contexts/AuthContext';
import { Check, X } from 'lucide-react';

const PermissionSelector = ({ currentPermissions, onChange, role }) => {
    // We use ADMIN permissions as the template for all available permissions
    const availableResources = PERMISSIONS[ROLES.ADMIN];

    // Helper to check if a permission is enabled
    const isEnabled = (resource, action = null) => {
        // If we have custom permissions, check them
        if (currentPermissions && currentPermissions[resource] !== undefined) {
            const perm = currentPermissions[resource];
            if (typeof perm === 'boolean') {
                // If it's a boolean permission (like dashboard), return it
                // If action is passed, return false (unless action is 'view'?)
                if (action === 'view') return perm;
                return action ? false : perm;
            }
            if (typeof perm === 'object') {
                return action ? perm[action] === true : true;
            }
        }

        // Fallback to role-based default if no custom permission exists yet
        // BUT, if we are editing permissions, we probably want to start with the Role's defaults
        // effectivePermissions passed in should already handle this "merge" logic or be pre-filled
        return false;
    };

    const togglePermission = (resource, action, value) => {
        const next = { ...currentPermissions };

        // Handle boolean resources (e.g., dashboard, analytics)
        if (typeof availableResources[resource] === 'boolean') {
            next[resource] = value;
        }
        // Handle object resources (e.g., bookings, customers)
        else {
            if (!next[resource] || typeof next[resource] !== 'object') {
                next[resource] = {};
            }

            if (action === 'all') {
                // Toggle all actions for this resource
                Object.keys(availableResources[resource]).forEach(key => {
                    next[resource][key] = value;
                });
            } else {
                next[resource] = {
                    ...next[resource],
                    [action]: value
                };
            }
        }

        onChange(next);
    };

    return (
        <div className="permission-selector">
            <div className="permission-header">
                <div className="col-resource">Page / Feature</div>
                <div className="col-actions">
                    <span>View</span>
                    <span>Create</span>
                    <span>Edit</span>
                    <span>Delete</span>
                </div>
            </div>

            <div className="permission-list">
                {Object.keys(availableResources).map((resource) => {
                    const template = availableResources[resource];
                    const isBoolean = typeof template === 'boolean';

                    return (
                        <div key={resource} className="permission-row">
                            <div className="resource-name">
                                <span className="resource-label">{resource.charAt(0).toUpperCase() + resource.slice(1)}</span>
                            </div>

                            <div className="resource-actions">
                                {isBoolean ? (
                                    // For boolean resources, we treat it as "View" access essentially, or just a single toggle
                                    <div className="action-cell">
                                        <label className="checkbox-container">
                                            <input
                                                type="checkbox"
                                                checked={isEnabled(resource, 'view')} // Treat boolean as view for consistency in check
                                                onChange={(e) => togglePermission(resource, null, e.target.checked)}
                                            />
                                            <span className="checkmark"></span>
                                        </label>
                                    </div>
                                ) : (
                                    // For complex resources, show checkboxes for available actions
                                    ['view', 'create', 'edit', 'delete'].map(action => {
                                        // Only show checkbox if the action is applicable for this resource (based on ADMIN template)
                                        if (template[action] === undefined) return <div key={action} className="action-cell empty"></div>;

                                        return (
                                            <div key={action} className="action-cell">
                                                <label className="checkbox-container">
                                                    <input
                                                        type="checkbox"
                                                        checked={isEnabled(resource, action)}
                                                        onChange={(e) => togglePermission(resource, action, e.target.checked)}
                                                    />
                                                    <span className="checkmark"></span>
                                                </label>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                .permission-selector {
                    background: #fff;
                    border: 1px solid var(--navy-200);
                    border-radius: var(--radius-md);
                    overflow-x: auto; /* Allow horizontal scroll on mobile */
                }
                
                /* Ensure minimum width for the table content so it doesn't squash */
                .permission-header, .permission-list {
                    min-width: 400px; 
                }
                
                .permission-header {
                    display: flex;
                    background: var(--navy-50);
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid var(--navy-200);
                    font-weight: 600;
                    font-size: 0.85rem;
                    color: var(--navy-700);
                }
                
                .col-resource {
                    flex: 1;
                    min-width: 120px;
                }
                
                .col-actions {
                    flex: 2;
                    display: flex;
                    justify-content: space-between;
                    min-width: 200px;
                }
                
                .col-actions span {
                    flex: 1;
                    text-align: center;
                }
                
                .permission-row {
                    display: flex;
                    padding: 0.75rem 1rem;
                    border-bottom: 1px solid var(--navy-100);
                    align-items: center;
                }
                
                .permission-row:last-child {
                    border-bottom: none;
                }
                
                .permission-row:hover {
                    background: var(--navy-50);
                }
                
                .resource-name {
                    flex: 1;
                    font-weight: 500;
                    color: var(--navy-800);
                    text-transform: capitalize;
                }
                
                .resource-actions {
                    flex: 2;
                    display: flex;
                    justify-content: space-between;
                }
                
                .action-cell {
                    flex: 1;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                
                /* Custom Checkbox */
                .checkbox-container {
                    display: block;
                    position: relative;
                    padding-left: 20px;
                    margin-bottom: 12px;
                    cursor: pointer;
                    font-size: 22px;
                    user-select: none;
                }

                .checkbox-container input {
                    position: absolute;
                    opacity: 0;
                    cursor: pointer;
                    height: 0;
                    width: 0;
                }

                .checkmark {
                    position: absolute;
                    top: 0;
                    left: 0;
                    height: 20px;
                    width: 20px;
                    background-color: #eee;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                }

                .checkbox-container:hover input ~ .checkmark {
                    background-color: #ccc;
                }

                .checkbox-container input:checked ~ .checkmark {
                    background-color: var(--primary);
                    border-color: var(--primary);
                }

                .checkmark:after {
                    content: "";
                    position: absolute;
                    display: none;
                }

                .checkbox-container input:checked ~ .checkmark:after {
                    display: block;
                }

                .checkbox-container .checkmark:after {
                    left: 7px;
                    top: 3px;
                    width: 5px;
                    height: 10px;
                    border: solid white;
                    border-width: 0 3px 3px 0;
                    transform: rotate(45deg);
                }
            `}</style>
        </div>
    );
};

export default PermissionSelector;
