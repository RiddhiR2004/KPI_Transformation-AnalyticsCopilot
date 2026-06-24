import { useEffect, useState, useRef } from "react";
import { 
  Building2, Search, Plus, Trash2, Check, X, Download, 
  ZoomIn, ZoomOut, Maximize, ArrowRight, Eye, Edit3, Loader2, Info, Zap, FileText,
  ChevronDown, ChevronRight
} from "lucide-react";
import { api, exportUrl } from "../lib/api";
import type { 
  ClientProfile, BusinessContext, KpiTreeRecord, KpiTreeData, 
  KpiTreeStrategicFocusAreaNode, KpiTreeStandardDriverNode, 
  KpiTreeSectorDriverNode, KpiTreeKpiNode, KpiTreeSourceContext
} from "../types/api";

type SelectedNodeInfo = {
  id: string; // e.g. "sfa-0", "sd-0-1", "ssd-0-1-0", "kpi-0-1-0-2"
  type: "sfa" | "sd" | "ssd" | "kpi";
  name: string;
  description: string;
  business_rationale: string;
  source_context: KpiTreeSourceContext;
  originalRef: any;
};

export function KpiDriverTreePage({ onChange }: { onChange: () => void }) {
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [businessContext, setBusinessContext] = useState<BusinessContext | null>(null);
  const [treeRecord, setTreeRecord] = useState<KpiTreeRecord | null>(null);
  const [treeData, setTreeData] = useState<KpiTreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [newParamName, setNewParamName] = useState("");
  const [newParamValue, setNewParamValue] = useState("");

  const isSameBranch = (idA: string, idB: string) => {
    if (!idA || !idB) return false;
    if (idA === "root" || idB === "root") return true;
    
    const partsA = idA.split("-");
    const partsB = idB.split("-");
    
    if (partsA[1] !== partsB[1]) return false;
    
    if (partsA[2] !== undefined && partsB[2] !== undefined) {
      if (partsA[2] !== partsB[2]) return false;
      
      if (partsA[3] !== undefined && partsB[3] !== undefined) {
        if (partsA[3] !== partsB[3]) return false;
        
        if (partsA[4] !== undefined && partsB[4] !== undefined) {
          if (partsA[4] !== partsB[4]) return false;
        }
      }
    }
    
    return true;
  };

  const isAnyHovered = hoveredNodeId !== null;
  const isNodeHigh = (nodeId: string) => {
    if (!isAnyHovered) return true;
    return isSameBranch(nodeId, hoveredNodeId!);
  };

  // Pan & Zoom state
  const [transform, setTransform] = useState({ x: 30, y: 30, scale: 0.7 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Dragging states for KPI nodes
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragNodeStartOffset, setDragNodeStartOffset] = useState({ x: 0, y: 0 });
  const [manualLayout, setManualLayout] = useState(false);

  const nodeOffsetsRef = useRef(nodeOffsets);
  const initialEditValueRef = useRef<string>("");
  useEffect(() => {
    nodeOffsetsRef.current = nodeOffsets;
  }, [nodeOffsets]);

  // Sync offsets/positions from treeData
  useEffect(() => {
    if (!treeData) return;
    const offsets: Record<string, { x: number; y: number }> = {};
    
    // Sync root node
    if (manualLayout) {
      if ((treeData as any).root_x_position !== undefined || (treeData as any).root_y_position !== undefined) {
        offsets["root"] = {
          x: (treeData as any).root_x_position || 0,
          y: (treeData as any).root_y_position || 0
        };
      }
    } else {
      if ((treeData as any).root_x_offset !== undefined || (treeData as any).root_y_offset !== undefined) {
        offsets["root"] = {
          x: (treeData as any).root_x_offset || 0,
          y: (treeData as any).root_y_offset || 0
        };
      }
    }

    treeData.strategic_focus_areas.forEach((sfa, sfaIdx) => {
      const sfaId = `sfa-${sfaIdx}`;
      if (manualLayout) {
        if (sfa.x_position !== undefined || sfa.y_position !== undefined) {
          offsets[sfaId] = {
            x: sfa.x_position || 0,
            y: sfa.y_position || 0
          };
        }
      } else {
        if (sfa.x_offset !== undefined || sfa.y_offset !== undefined) {
          offsets[sfaId] = {
            x: sfa.x_offset || 0,
            y: sfa.y_offset || 0
          };
        }
      }
      (sfa.drivers || []).forEach((sd, sdIdx) => {
        const sdId = `sd-${sfaIdx}-${sdIdx}`;
        if (manualLayout) {
          if (sd.x_position !== undefined || sd.y_position !== undefined) {
            offsets[sdId] = {
              x: sd.x_position || 0,
              y: sd.y_position || 0
            };
          }
        } else {
          if (sd.x_offset !== undefined || sd.y_offset !== undefined) {
            offsets[sdId] = {
              x: sd.x_offset || 0,
              y: sd.y_offset || 0
            };
          }
        }
        const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
        ssds.forEach((ssd: any, ssdIdx: any) => {
          const ssdId = `ssd-${sfaIdx}-${sdIdx}-${ssdIdx}`;
          if (manualLayout) {
            if (ssd.x_position !== undefined || ssd.y_position !== undefined) {
              offsets[ssdId] = {
                x: ssd.x_position || 0,
                y: ssd.y_position || 0
              };
            }
          } else {
            if (ssd.x_offset !== undefined || ssd.y_offset !== undefined) {
              offsets[ssdId] = {
                x: ssd.x_offset || 0,
                y: ssd.y_offset || 0
              };
            }
          }
          (ssd.kpis || []).forEach((kpi: any, kpiIdx: any) => {
            const kpiId = `kpi-${sfaIdx}-${sdIdx}-${ssdIdx}-${kpiIdx}`;
            if (manualLayout) {
              if (kpi.x_position !== undefined || kpi.y_position !== undefined) {
                offsets[kpiId] = {
                  x: kpi.x_position || 0,
                  y: kpi.y_position || 0
                };
              }
            } else {
              if (kpi.x_offset !== undefined || kpi.y_offset !== undefined) {
                offsets[kpiId] = {
                  x: kpi.x_offset || 0,
                  y: kpi.y_offset || 0
                };
              }
            }
          });
        });
      });
    });
    setNodeOffsets(offsets);
  }, [treeData, manualLayout]);

  // Load manual layout mode from treeData when fetched
  useEffect(() => {
    if (treeData && (treeData as any).manual_layout !== undefined) {
      setManualLayout((treeData as any).manual_layout);
    }
  }, [treeData]);

  const updateNodePositionInTreeData = (nodeId: string, x: number, y: number) => {
    if (!treeData) return;
    const parts = nodeId.split("-");
    const type = parts[0];
    if (type !== "sfa" && type !== "sd" && type !== "ssd" && type !== "kpi" && type !== "root") return;

    const nextTreeData = { ...treeData };

    if (type === "root") {
      if (manualLayout) {
        (nextTreeData as any).root_x_position = x;
        (nextTreeData as any).root_y_position = y;
      } else {
        (nextTreeData as any).root_x_offset = x;
        (nextTreeData as any).root_y_offset = y;
      }
      setTreeData(nextTreeData);
      return;
    }

    const sfaIdx = parseInt(parts[1], 10);
    const sdIdx = parts[2] !== undefined ? parseInt(parts[2], 10) : -1;
    const ssdIdx = parts[3] !== undefined ? parseInt(parts[3], 10) : -1;
    const kpiIdx = parts[4] !== undefined ? parseInt(parts[4], 10) : -1;

    const sfa = nextTreeData.strategic_focus_areas[sfaIdx];
    if (!sfa) return;

    let targetNode: any = null;
    if (type === "sfa") {
      targetNode = sfa;
    } else if (type === "sd") {
      targetNode = (sfa.drivers || [])[sdIdx];
    } else if (type === "ssd") {
      const sd = (sfa.drivers || [])[sdIdx];
      if (sd) {
        const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
        targetNode = ssds[ssdIdx];
      }
    } else if (type === "kpi") {
      const sd = (sfa.drivers || [])[sdIdx];
      if (sd) {
        const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
        const ssd = ssds[ssdIdx];
        if (ssd) {
          const kpis = ssd.kpis || [];
          targetNode = kpis[kpiIdx];
        }
      }
    }

    if (targetNode) {
      if (manualLayout) {
        targetNode.x_position = x;
        targetNode.y_position = y;
      } else {
        targetNode.x_offset = x;
        targetNode.y_offset = y;
      }
    }

    setTreeData(nextTreeData);
  };

  const handleKpiMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    e.preventDefault();
    setDraggingNodeId(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragNodeStartOffset(nodeOffsets[nodeId] || { x: 0, y: 0 });
  };

  const handleKpiMouseMove = (e: MouseEvent) => {
    if (!draggingNodeId) return;
    const dx = (e.clientX - dragStart.x) / transform.scale;
    const dy = (e.clientY - dragStart.y) / transform.scale;
    const newOffset = {
      x: dragNodeStartOffset.x + dx,
      y: dragNodeStartOffset.y + dy
    };
    setNodeOffsets(prev => ({
      ...prev,
      [draggingNodeId]: newOffset
    }));
  };

  const handleKpiMouseUp = () => {
    if (draggingNodeId) {
      const finalOffset = nodeOffsetsRef.current[draggingNodeId] || { x: 0, y: 0 };
      const oldOffset = dragNodeStartOffset;
      const hasMoved = Math.abs(finalOffset.x - oldOffset.x) > 1 || Math.abs(finalOffset.y - oldOffset.y) > 1;

      updateNodePositionInTreeData(draggingNodeId, finalOffset.x, finalOffset.y);
      setDraggingNodeId(null);

      if (hasMoved && treeData) {
        const parts = draggingNodeId.split("-");
        const type = parts[0];
        const sfaIdx = parseInt(parts[1], 10);
        const sdIdx = parts[2] !== undefined ? parseInt(parts[2], 10) : -1;
        const ssdIdx = parts[3] !== undefined ? parseInt(parts[3], 10) : -1;
        const kpiIdx = parts[4] !== undefined ? parseInt(parts[4], 10) : -1;

        let nodeName = "Node";
        let entityType = "Node";
        let actionLabel = "Move Node";

        const sfa = treeData.strategic_focus_areas[sfaIdx];
        if (sfa) {
          if (type === "sfa") {
            nodeName = sfa.name;
            entityType = "Strategic Focus Area";
            actionLabel = "Move Strategic Focus Area";
          } else if (type === "sd") {
            const sd = sfa.drivers[sdIdx];
            if (sd) {
              nodeName = sd.name;
              entityType = "Standard Driver";
              actionLabel = "Move Standard Driver";
            }
          } else if (type === "ssd") {
            const sd = sfa.drivers[sdIdx];
            if (sd) {
              const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
              const ssd = ssds[ssdIdx];
              if (ssd) {
                nodeName = ssd.name;
                entityType = "Sector Driver";
                actionLabel = "Move Sector Driver";
              }
            }
          } else if (type === "kpi") {
            const sd = sfa.drivers[sdIdx];
            if (sd) {
              const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
              const ssd = ssds[ssdIdx];
              if (ssd) {
                const kpi = ssd.kpis[kpiIdx];
                if (kpi) {
                  nodeName = kpi.kpi_name;
                  entityType = "Operational KPI";
                  actionLabel = "Move Operational KPI";
                }
              }
            }
          }
        }

        const nextTreeData = JSON.parse(JSON.stringify(treeData));
        if (type === "root") {
          if (manualLayout) {
            (nextTreeData as any).root_x_position = finalOffset.x;
            (nextTreeData as any).root_y_position = finalOffset.y;
          } else {
            (nextTreeData as any).root_x_offset = finalOffset.x;
            (nextTreeData as any).root_y_offset = finalOffset.y;
          }
        } else {
          const sfaCopy = nextTreeData.strategic_focus_areas[sfaIdx];
          if (sfaCopy) {
            let targetNode: any = null;
            if (type === "sfa") {
              targetNode = sfaCopy;
            } else if (type === "sd") {
              targetNode = (sfaCopy.drivers || [])[sdIdx];
            } else if (type === "ssd") {
              const sd = (sfaCopy.drivers || [])[sdIdx];
              if (sd) {
                const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
                targetNode = ssds[ssdIdx];
              }
            } else if (type === "kpi") {
              const sd = (sfaCopy.drivers || [])[sdIdx];
              if (sd) {
                const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
                const ssd = ssds[ssdIdx];
                if (ssd) {
                  const kpis = ssd.kpis || [];
                  targetNode = kpis[kpiIdx];
                }
              }
            }
            if (targetNode) {
              if (manualLayout) {
                targetNode.x_position = finalOffset.x;
                targetNode.y_position = finalOffset.y;
              } else {
                targetNode.x_offset = finalOffset.x;
                targetNode.y_offset = finalOffset.y;
              }
            }
          }
        }

        void saveTreeWithAction(
          nextTreeData,
          actionLabel,
          entityType,
          nodeName,
          `x: ${Math.round(oldOffset.x)}, y: ${Math.round(oldOffset.y)}`,
          `x: ${Math.round(finalOffset.x)}, y: ${Math.round(finalOffset.y)}`
        );
      }
    }
  };

  useEffect(() => {
    if (draggingNodeId) {
      window.addEventListener("mousemove", handleKpiMouseMove);
      window.addEventListener("mouseup", handleKpiMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleKpiMouseMove);
      window.removeEventListener("mouseup", handleKpiMouseUp);
    };
  }, [draggingNodeId, dragStart, dragNodeStartOffset]);

  // Fetch initial profile, context, and KPI tree
  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getClientProfile().catch(() => null),
      api.getContext().catch(() => null),
      api.getKpiTree().catch(() => null)
    ])
      .then(([profile, context, tree]) => {
        if (profile) setClientProfile(profile);
        if (context) setBusinessContext(context as BusinessContext);
        if (tree) {
          setTreeRecord(tree);
          setTreeData(tree.data);
        }
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load data.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Set up mouse wheel listener for zooming
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const handleWheelZoom = (e: WheelEvent) => {
      e.preventDefault();
      const intensity = 0.05;
      setTransform((prev) => {
        const nextScale = e.deltaY < 0 
          ? Math.min(2.0, prev.scale + intensity)
          : Math.max(0.4, prev.scale - intensity);
        return { ...prev, scale: nextScale };
      });
    };

    wrapper.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => wrapper.removeEventListener("wheel", handleWheelZoom);
  }, [transform.scale]);

  // Pan event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" || 
      target.tagName === "TEXTAREA" || 
      target.tagName === "BUTTON" || 
      target.closest(".no-pan")
    ) {
      return;
    }
    e.preventDefault();
    setIsPanning(true);
    setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPanning) return;
    setTransform((prev) => ({
      ...prev,
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y
    }));
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    if (isPanning) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning, panStart]);

  // Zoom helpers
  const zoomIn = () => setTransform(p => ({ ...p, scale: Math.min(2, p.scale + 0.1) }));
  const zoomOut = () => setTransform(p => ({ ...p, scale: Math.max(0.4, p.scale - 0.1) }));
  const resetZoom = () => setTransform({ x: 30, y: 30, scale: 0.7 });
  const fitToScreen = () => {
    if (!treeData) return;
    const layout = calculateLayout(treeData, nodeOffsets);
    const scaleX = 800 / (layout.width + 100);
    const scaleY = 500 / (layout.height + 100);
    const bestScale = Math.max(0.4, Math.min(1.2, Math.min(scaleX, scaleY)));
    setTransform({ x: 20, y: 20, scale: bestScale });
  };

  // Generate Tree
  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setErrorMessage(null);
      
      const steps = [
        "Analyzing approved library KPIs...",
        "Grouping by strategic objectives...",
        "Decomposing standard value drivers...",
        "Synthesizing sector-specific operational drivers...",
        "Assembling strategy-to-KPI traceability hierarchy..."
      ];

      let currentStep = 0;
      setGenerationStep(steps[currentStep]);
      const interval = setInterval(() => {
        currentStep = (currentStep + 1) % steps.length;
        setGenerationStep(steps[currentStep]);
      }, 1800);

      const tree = await api.generateKpiTree();
      clearInterval(interval);
      
      setTreeRecord(tree);
      setTreeData(tree.data);
      setSelectedNode(null);
      setSuccessMessage(`KPI Driver tree version ${tree.version} generated successfully!`);
      void onChange();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  // Save Tree
  const handleSave = async () => {
    if (!treeRecord || !treeData) return;
    try {
      setErrorMessage(null);
      await api.saveKpiTree({ name: treeRecord.name, data: treeData });
      setTreeRecord(prev => prev ? { ...prev, data: treeData } : null);
      setSuccessMessage("KPI Driver tree changes saved successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
      void onChange();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save tree.");
    }
  };

  const saveTreeWithAction = async (
    nextData: typeof treeData,
    action: string,
    entityType: string,
    entityName: string,
    prevValue?: string,
    newValue?: string
  ) => {
    if (!treeRecord || !nextData) return;
    try {
      setErrorMessage(null);
      await api.saveKpiTree({
        name: treeRecord.name,
        data: nextData,
        action,
        entity_type: entityType,
        entity_name: entityName,
        previous_value: prevValue,
        new_value: newValue
      });
      setTreeRecord(prev => prev ? { ...prev, data: nextData } : null);
      void onChange();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to auto-save tree.");
    }
  };

  // Approve / Unapprove Tree
  const handleApproveStatus = async (approved: boolean) => {
    if (!treeRecord) return;
    try {
      setErrorMessage(null);
      const res = await api.approveKpiTree(approved);
      setTreeRecord(prev => prev ? { ...prev, status: res.status_value as any } : null);
      setSuccessMessage(approved ? "KPI Driver tree approved successfully!" : "KPI Driver tree reopened for editing.");
      setTimeout(() => setSuccessMessage(null), 3500);
      void onChange();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to change approval status.");
    }
  };

  // Tree Modifier functions (only active in Draft mode)
  const handleAddSfa = () => {
    if (!treeData) return;
    const rootNode = layout.nodes.find(n => n.type === "root");
    const parentX = rootNode ? rootNode.x : 30;
    const parentY = rootNode ? rootNode.y : 200;
    const siblings = treeData.strategic_focus_areas;
    const pos = getIntelligentPosition("sfa", parentX, parentY, siblings);

    const newSfa: KpiTreeStrategicFocusAreaNode = {
      name: "New Strategic Focus Area",
      description: "Define strategic priority context.",
      business_rationale: "Align with client corporate goals.",
      source_context: {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      },
      drivers: [],
      x_position: pos.x,
      y_position: pos.y
    };
    
    const updated = {
      ...treeData,
      strategic_focus_areas: [...treeData.strategic_focus_areas, newSfa]
    };
    setTreeData(updated);
    
    const sfaIdx = updated.strategic_focus_areas.length - 1;
    const newId = `sfa-${sfaIdx}`;
    setNodeOffsets(prev => ({
      ...prev,
      [newId]: { x: pos.x, y: pos.y }
    }));

    setSelectedNode({
      id: newId,
      type: "sfa",
      name: newSfa.name,
      description: newSfa.description || "",
      business_rationale: newSfa.business_rationale || "",
      source_context: newSfa.source_context || {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      },
      originalRef: newSfa
    });

    void saveTreeWithAction(updated, "Add Strategic Focus Area", "Strategic Focus Area", newSfa.name);
  };

  const handleAddSd = (sfaIdx: number) => {
    if (!treeData) return;
    const sfa = treeData.strategic_focus_areas[sfaIdx];
    const parentNode = layout.nodes.find(n => n.id === `sfa-${sfaIdx}`);
    const parentX = parentNode ? parentNode.x : 220;
    const parentY = parentNode ? parentNode.y : 100;
    const siblings = sfa.drivers || [];
    const pos = getIntelligentPosition("sd", parentX, parentY, siblings);

    const newSd: KpiTreeStandardDriverNode = {
      name: "New Standard Driver",
      description: "Define core value driver.",
      business_rationale: "Detail standard consulting driver scope.",
      source_context: {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      },
      sector_specific_drivers: [],
      x_position: pos.x,
      y_position: pos.y
    };
    
    const sfas = [...treeData.strategic_focus_areas];
    sfas[sfaIdx] = {
      ...sfas[sfaIdx],
      drivers: [...sfas[sfaIdx].drivers, newSd]
    };
    
    const updated = { ...treeData, strategic_focus_areas: sfas };
    setTreeData(updated);
    
    const sdIdx = sfas[sfaIdx].drivers.length - 1;
    const newId = `sd-${sfaIdx}-${sdIdx}`;
    setNodeOffsets(prev => ({
      ...prev,
      [newId]: { x: pos.x, y: pos.y }
    }));

    setSelectedNode({
      id: newId,
      type: "sd",
      name: newSd.name,
      description: newSd.description || "",
      business_rationale: newSd.business_rationale || "",
      source_context: newSd.source_context || {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      },
      originalRef: newSd
    });

    void saveTreeWithAction(updated, "Add Standard Driver", "Standard Driver", newSd.name);
  };

  const handleAddSsd = (sfaIdx: number, sdIdx: number) => {
    if (!treeData) return;
    const sfa = treeData.strategic_focus_areas[sfaIdx];
    const sd = sfa.drivers[sdIdx];
    const parentNode = layout.nodes.find(n => n.id === `sd-${sfaIdx}-${sdIdx}`);
    const parentX = parentNode ? parentNode.x : 520;
    const parentY = parentNode ? parentNode.y : 100;
    const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
    const pos = getIntelligentPosition("ssd", parentX, parentY, ssds);

    const newSsd: KpiTreeSectorDriverNode = {
      name: "New Sector Driver",
      description: "Define localized industry driver.",
      business_rationale: "Connect strategic driver to sector nuances.",
      source_context: {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      },
      kpis: [],
      x_position: pos.x,
      y_position: pos.y
    };
    
    const sfas = [...treeData.strategic_focus_areas];
    const updatedSsds = [...ssds];
    
    const drivers = [...sfa.drivers];
    drivers[sdIdx] = {
      ...sd,
      sector_specific_drivers: [...updatedSsds, newSsd]
    };
    sfas[sfaIdx] = { ...sfa, drivers };
    
    const updated = { ...treeData, strategic_focus_areas: sfas };
    setTreeData(updated);
    
    const ssdIdx = ssds.length;
    const newId = `ssd-${sfaIdx}-${sdIdx}-${ssdIdx}`;
    setNodeOffsets(prev => ({
      ...prev,
      [newId]: { x: pos.x, y: pos.y }
    }));

    setSelectedNode({
      id: newId,
      type: "ssd",
      name: newSsd.name,
      description: newSsd.description || "",
      business_rationale: newSsd.business_rationale || "",
      source_context: newSsd.source_context || {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      },
      originalRef: newSsd
    });

    void saveTreeWithAction(updated, "Add Sector Driver", "Sector Driver", newSsd.name);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!treeData) return;
    
    const parts = nodeId.split("-");
    const type = parts[0] as "sfa" | "sd" | "ssd" | "kpi";
    const sfaIdx = parseInt(parts[1], 10);
    
    if (type === "sfa") {
      const sfa = treeData.strategic_focus_areas[sfaIdx];
      if (sfa.drivers.length > 0) {
        if (!confirm("This Focus Area contains sub-drivers and KPIs. Are you sure you want to delete it and all its children?")) {
          return;
        }
      }
      const sfas = treeData.strategic_focus_areas.filter((_, idx) => idx !== sfaIdx);
      const updated = { ...treeData, strategic_focus_areas: sfas };
      setTreeData(updated);
      setSelectedNode(null);
      void saveTreeWithAction(updated, "Delete Strategic Focus Area", "Strategic Focus Area", sfa.name);
      return;
    }
    
    if (type === "sd") {
      const sdIdx = parseInt(parts[2], 10);
      const sfa = treeData.strategic_focus_areas[sfaIdx];
      const sd = sfa.drivers[sdIdx];
      const ssdCount = (sd.sector_specific_drivers || (sd as any).sector_drivers || []).length;
      if (ssdCount > 0) {
        if (!confirm("This standard driver has children. Delete anyway?")) {
          return;
        }
      }
      const drivers = sfa.drivers.filter((_, idx) => idx !== sdIdx);
      const sfas = [...treeData.strategic_focus_areas];
      sfas[sfaIdx] = { ...sfa, drivers };
      const updated = { ...treeData, strategic_focus_areas: sfas };
      setTreeData(updated);
      setSelectedNode(null);
      void saveTreeWithAction(updated, "Delete Standard Driver", "Standard Driver", sd.name);
      return;
    }
    
    if (type === "ssd") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const sfa = treeData.strategic_focus_areas[sfaIdx];
      const sd = sfa.drivers[sdIdx];
      const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
      const ssd = ssds[ssdIdx];
      
      if (ssd.kpis.length > 0) {
        if (!confirm("This driver is mapped to KPIs. Delete anyway?")) {
          return;
        }
      }
      const updatedSsds = ssds.filter((_: any, idx: number) => idx !== ssdIdx);
      const drivers = [...sfa.drivers];
      drivers[sdIdx] = {
        ...sd,
        sector_specific_drivers: updatedSsds
      };
      const sfas = [...treeData.strategic_focus_areas];
      sfas[sfaIdx] = { ...sfa, drivers };
      const updated = { ...treeData, strategic_focus_areas: sfas };
      setTreeData(updated);
      setSelectedNode(null);
      void saveTreeWithAction(updated, "Delete Sector Driver", "Sector Driver", ssd.name);
      return;
    }
    
    if (type === "kpi") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const kpiIdx = parseInt(parts[4], 10);
      
      const sfa = treeData.strategic_focus_areas[sfaIdx];
      const sd = sfa.drivers[sdIdx];
      const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
      const ssd = ssds[ssdIdx];
      const kpi = ssd.kpis[kpiIdx];
      
      const updatedKpis = ssd.kpis.filter((_: any, idx: number) => idx !== kpiIdx);
      const updatedSsds = [...ssds];
      updatedSsds[ssdIdx] = { ...ssd, kpis: updatedKpis };
      
      const drivers = [...sfa.drivers];
      drivers[sdIdx] = { ...sd, sector_specific_drivers: updatedSsds };
      
      const sfas = [...treeData.strategic_focus_areas];
      sfas[sfaIdx] = { ...sfa, drivers };
      
      const updated = { ...treeData, strategic_focus_areas: sfas };
      setTreeData(updated);
      setSelectedNode(null);
      void saveTreeWithAction(updated, "Remove Operational KPI", "Operational KPI", kpi.kpi_name);
      return;
    }
  };

  // Reassign / Move KPI
  const handleMoveKpi = (targetSsdUniqueId: string) => {
    if (!selectedNode || selectedNode.type !== "kpi" || !treeData) return;
    
    const parts = selectedNode.id.split("-");
    const sfaIdx = parseInt(parts[1], 10);
    const sdIdx = parseInt(parts[2], 10);
    const ssdIdx = parseInt(parts[3], 10);
    const kpiIdx = parseInt(parts[4], 10);
    
    const targetParts = targetSsdUniqueId.split("-");
    const targetSfaIdx = parseInt(targetParts[1], 10);
    const targetSdIdx = parseInt(targetParts[2], 10);
    const targetSsdIdx = parseInt(targetParts[3], 10);
    
    const sfas = JSON.parse(JSON.stringify(treeData.strategic_focus_areas));
    
    const currentSsd = (sfas[sfaIdx].drivers[sdIdx].sector_specific_drivers || sfas[sfaIdx].drivers[sdIdx].sector_drivers)[ssdIdx];
    const kpiToMove = currentSsd.kpis[kpiIdx];
    
    currentSsd.kpis.splice(kpiIdx, 1);
    
    const targetSsd = (sfas[targetSfaIdx].drivers[targetSdIdx].sector_specific_drivers || sfas[targetSfaIdx].drivers[targetSdIdx].sector_drivers)[targetSsdIdx];
    targetSsd.kpis = targetSsd.kpis || [];
    targetSsd.kpis.push(kpiToMove);
    
    const updatedTree = { ...treeData, strategic_focus_areas: sfas };
    setTreeData(updatedTree);
    
    const newKpiIdx = targetSsd.kpis.length - 1;
    const newId = `kpi-${targetSfaIdx}-${targetSdIdx}-${targetSsdIdx}-${newKpiIdx}`;
    setSelectedNode({
      id: newId,
      type: "kpi",
      name: kpiToMove.kpi_name || kpiToMove.name,
      description: kpiToMove.kpi_description || kpiToMove.description || "",
      business_rationale: "",
      source_context: kpiToMove.source_context || {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      },
      originalRef: kpiToMove
    });

    void saveTreeWithAction(
      updatedTree,
      "Move Operational KPI",
      "Operational KPI",
      kpiToMove.kpi_name || kpiToMove.name,
      `Driver: ${currentSsd.name}`,
      `Driver: ${targetSsd.name}`
    );
  };

  // Spacing allocator helper for intelligent node placement
  const getIntelligentPosition = (
    type: "sfa" | "sd" | "ssd" | "kpi",
    parentX: number,
    parentY: number,
    siblings: any[]
  ) => {
    let targetX = parentX + 250;
    if (type === "sfa") targetX = 220;
    else if (type === "sd") targetX = 520;
    else if (type === "ssd") targetX = 820;
    else if (type === "kpi") targetX = 1120;

    let targetY = parentY;
    if (siblings && siblings.length > 0) {
      let maxY = parentY;
      siblings.forEach(sib => {
        const yVal = sib.x_position !== undefined || sib.y_position !== undefined 
          ? (sib.y_position || 0) 
          : sib.y_offset !== undefined 
          ? (parentY + sib.y_offset) 
          : parentY;
        if (yVal > maxY) {
          maxY = yVal;
        }
      });
      targetY = maxY + 120;
    }

    // Prevent overlaps by checking nodes in same column
    let attempts = 0;
    let foundSpot = false;
    while (!foundSpot && attempts < 50) {
      const overlap = layout.nodes.some(node => {
        if (node.type !== type) return false;
        if (Math.abs(node.x - targetX) > 50) return false;
        return Math.abs(node.y - targetY) < 120;
      });

      if (overlap) {
        targetY += 120;
        attempts++;
      } else {
        foundSpot = true;
      }
    }

    return { x: targetX, y: targetY };
  };

  const handleToggleCollapse = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (!treeData) return;
    const parts = nodeId.split("-");
    const type = parts[0];
    const sfaIdx = parseInt(parts[1], 10);
    const sdIdx = parts[2] !== undefined ? parseInt(parts[2], 10) : -1;
    const ssdIdx = parts[3] !== undefined ? parseInt(parts[3], 10) : -1;

    const nextTreeData = JSON.parse(JSON.stringify(treeData));
    const sfa = nextTreeData.strategic_focus_areas[sfaIdx];
    if (!sfa) return;

    let isCollapsedNew = false;
    let nodeName = "Branch";
    let entityType = "Node";

    if (type === "sfa") {
      sfa.collapsed = !sfa.collapsed;
      isCollapsedNew = !!sfa.collapsed;
      nodeName = sfa.name;
      entityType = "Strategic Focus Area";
    } else if (type === "sd") {
      const sd = (sfa.drivers || [])[sdIdx];
      if (sd) {
        sd.collapsed = !sd.collapsed;
        isCollapsedNew = !!sd.collapsed;
        nodeName = sd.name;
        entityType = "Standard Driver";
      }
    } else if (type === "ssd") {
      const sd = (sfa.drivers || [])[sdIdx];
      if (sd) {
        const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
        const ssd = ssds[ssdIdx];
        if (ssd) {
          ssd.collapsed = !ssd.collapsed;
          isCollapsedNew = !!ssd.collapsed;
          nodeName = ssd.name;
          entityType = "Sector Driver";
        }
      }
    }

    setTreeData(nextTreeData);

    const actionLabel = isCollapsedNew ? "Collapse Branch" : "Expand Branch";
    void saveTreeWithAction(
      nextTreeData,
      actionLabel,
      entityType,
      nodeName,
      isCollapsedNew ? "Expanded" : "Collapsed",
      isCollapsedNew ? "Collapsed" : "Expanded"
    );
  };

  const handleAddKpi = (sfaIdx: number, sdIdx: number, ssdIdx: number) => {
    if (!treeData) return;
    const sfa = treeData.strategic_focus_areas[sfaIdx];
    const sd = sfa.drivers[sdIdx];
    const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
    const ssd = ssds[ssdIdx];
    
    const parentNode = layout.nodes.find(n => n.id === `ssd-${sfaIdx}-${sdIdx}-${ssdIdx}`);
    const parentX = parentNode ? parentNode.x : 820;
    const parentY = parentNode ? parentNode.y : 100;
    
    const kpis = ssd.kpis || [];
    const pos = getIntelligentPosition("kpi", parentX, parentY, kpis);

    const newKpi: KpiTreeKpiNode = {
      kpi_name: "New Operational KPI",
      kpi_description: "Define metric context.",
      source_context: {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      },
      x_position: pos.x,
      y_position: pos.y
    };
    
    const sfas = [...treeData.strategic_focus_areas];
    const updatedSsds = [...ssds];
    updatedSsds[ssdIdx] = {
      ...ssd,
      kpis: [...kpis, newKpi]
    };
    
    const drivers = [...sfa.drivers];
    drivers[sdIdx] = {
      ...sd,
      sector_specific_drivers: updatedSsds
    };
    sfas[sfaIdx] = { ...sfa, drivers };
    
    const updated = { ...treeData, strategic_focus_areas: sfas };
    setTreeData(updated);
    
    const kpiIdx = kpis.length;
    const newId = `kpi-${sfaIdx}-${sdIdx}-${ssdIdx}-${kpiIdx}`;
    setNodeOffsets(prev => ({
      ...prev,
      [newId]: { x: pos.x, y: pos.y }
    }));

    setSelectedNode({
      id: newId,
      type: "kpi",
      name: newKpi.kpi_name,
      description: newKpi.kpi_description || "",
      business_rationale: "",
      source_context: newKpi.source_context || {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      },
      originalRef: newKpi
    });

    void saveTreeWithAction(updated, "Add Operational KPI", "Operational KPI", newKpi.kpi_name);
  };

  const handleToggleManualLayout = () => {
    if (!treeData) return;
    const nextManual = !manualLayout;
    setManualLayout(nextManual);
    setTreeData({
      ...treeData,
      manual_layout: nextManual
    } as any);
  };

  // Update selected node fields in draft state
  const handleUpdateNodeFields = (fields: { name?: string; description?: string; business_rationale?: string }) => {
    if (!selectedNode || !treeData) return;
    
    const { id, type } = selectedNode;
    const parts = id.split("-");
    const sfaIdx = parseInt(parts[1], 10);
    
    const sfas = [...treeData.strategic_focus_areas];
    
    if (type === "sfa") {
      sfas[sfaIdx] = {
        ...sfas[sfaIdx],
        ...fields
      };
    } else if (type === "sd") {
      const sdIdx = parseInt(parts[2], 10);
      sfas[sfaIdx].drivers[sdIdx] = {
        ...sfas[sfaIdx].drivers[sdIdx],
        ...fields
      };
    } else if (type === "ssd") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const sd = sfas[sfaIdx].drivers[sdIdx];
      const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
      ssds[ssdIdx] = {
        ...ssds[ssdIdx],
        ...fields
      };
    } else if (type === "kpi") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const kpiIdx = parseInt(parts[4], 10);
      
      const sd = sfas[sfaIdx].drivers[sdIdx];
      const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
      const ssd = ssds[ssdIdx];
      
      ssd.kpis[kpiIdx] = {
        ...ssd.kpis[kpiIdx],
        kpi_name: fields.name !== undefined ? fields.name : ssd.kpis[kpiIdx].kpi_name,
        kpi_description: fields.description !== undefined ? fields.description : ssd.kpis[kpiIdx].kpi_description
      };
    }
    
    setTreeData({ ...treeData, strategic_focus_areas: sfas });
    setSelectedNode(prev => prev ? { ...prev, ...fields } : null);
  };

  // Toggle Context parameter mapping
  const handleToggleSourceContext = (category: keyof KpiTreeSourceContext, value: string) => {
    if (!selectedNode || !treeData) return;
    
    const { id, type } = selectedNode;
    const parts = id.split("-");
    const sfaIdx = parseInt(parts[1], 10);
    
    const sfas = [...treeData.strategic_focus_areas];
    let currentCtx: KpiTreeSourceContext;
    
    let targetNodeRef: any;
    if (type === "sfa") {
      targetNodeRef = sfas[sfaIdx];
    } else if (type === "sd") {
      const sdIdx = parseInt(parts[2], 10);
      targetNodeRef = sfas[sfaIdx].drivers[sdIdx];
    } else if (type === "ssd") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const sdRef = sfas[sfaIdx].drivers[sdIdx] as any;
      targetNodeRef = (sdRef.sector_specific_drivers || sdRef.sector_drivers)[ssdIdx];
    } else if (type === "kpi") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const kpiIdx = parseInt(parts[4], 10);
      const sdRef = sfas[sfaIdx].drivers[sdIdx] as any;
      targetNodeRef = (sdRef.sector_specific_drivers || sdRef.sector_drivers)[ssdIdx].kpis[kpiIdx];
    }
    
    if (!targetNodeRef.source_context) {
      targetNodeRef.source_context = {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      };
    }
    
    currentCtx = targetNodeRef.source_context;
    
    const list = [...(currentCtx[category] || [])];
    const existsIdx = list.indexOf(value);
    if (existsIdx > -1) {
      list.splice(existsIdx, 1);
    } else {
      list.push(value);
    }
    
    targetNodeRef.source_context = {
      ...currentCtx,
      [category]: list
    };
    
    const updated = { ...treeData, strategic_focus_areas: sfas };
    setTreeData(updated);
    setSelectedNode(prev => prev ? {
      ...prev,
      source_context: targetNodeRef.source_context
    } : null);

    let entityType = "Node";
    if (type === "sfa") entityType = "Strategic Focus Area";
    else if (type === "sd") entityType = "Standard Driver";
    else if (type === "ssd") entityType = "Sector Driver";
    else if (type === "kpi") entityType = "Operational KPI";

    void saveTreeWithAction(
      updated,
      "Update Strategy Traceability",
      entityType,
      selectedNode.name,
      JSON.stringify(currentCtx[category] || []),
      JSON.stringify(list)
    );
  };

  const handleAddNodeCustomParam = () => {
    if (!newParamName.trim() || !newParamValue.trim()) return;
    const value = `${newParamName.trim()}: ${newParamValue.trim()}`;
    if (!selectedNode || !treeData) return;
    
    const { id, type } = selectedNode;
    const parts = id.split("-");
    const sfaIdx = parseInt(parts[1], 10);
    
    const sfas = [...treeData.strategic_focus_areas];
    let targetNodeRef: any;
    if (type === "sfa") {
      targetNodeRef = sfas[sfaIdx];
    } else if (type === "sd") {
      const sdIdx = parseInt(parts[2], 10);
      targetNodeRef = sfas[sfaIdx].drivers[sdIdx];
    } else if (type === "ssd") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const sdRef = sfas[sfaIdx].drivers[sdIdx] as any;
      targetNodeRef = (sdRef.sector_specific_drivers || sdRef.sector_drivers)[ssdIdx];
    } else if (type === "kpi") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const kpiIdx = parseInt(parts[4], 10);
      const sdRef = sfas[sfaIdx].drivers[sdIdx] as any;
      targetNodeRef = (sdRef.sector_specific_drivers || sdRef.sector_drivers)[ssdIdx].kpis[kpiIdx];
    }
    
    if (!targetNodeRef.source_context) {
      targetNodeRef.source_context = {
        strategic_objectives: [],
        business_challenges: [],
        kras: [],
        functional_areas: [],
        custom_parameters: []
      };
    }
    if (!targetNodeRef.source_context.custom_parameters) {
      targetNodeRef.source_context.custom_parameters = [];
    }

    const prevParams = [...targetNodeRef.source_context.custom_parameters];
    
    let list = [...targetNodeRef.source_context.custom_parameters];
    if (!list.includes(value)) {
      list = [...list, value];
      targetNodeRef.source_context.custom_parameters = list;
    }
    
    const updated = { ...treeData, strategic_focus_areas: sfas };
    setTreeData(updated);
    setSelectedNode(prev => prev ? {
      ...prev,
      source_context: targetNodeRef.source_context
    } : null);
    
    setNewParamName("");
    setNewParamValue("");

    let entityType = "Node";
    if (type === "sfa") entityType = "Strategic Focus Area";
    else if (type === "sd") entityType = "Standard Driver";
    else if (type === "ssd") entityType = "Sector Driver";
    else if (type === "kpi") entityType = "Operational KPI";

    void saveTreeWithAction(
      updated,
      "Update Strategy Traceability",
      entityType,
      selectedNode.name,
      JSON.stringify(prevParams),
      JSON.stringify(list)
    );
  };

  const handleRemoveNodeCustomParam = (indexToRemove: number) => {
    if (!selectedNode || !treeData) return;
    
    const { id, type } = selectedNode;
    const parts = id.split("-");
    const sfaIdx = parseInt(parts[1], 10);
    
    const sfas = [...treeData.strategic_focus_areas];
    let targetNodeRef: any;
    if (type === "sfa") {
      targetNodeRef = sfas[sfaIdx];
    } else if (type === "sd") {
      const sdIdx = parseInt(parts[2], 10);
      targetNodeRef = sfas[sfaIdx].drivers[sdIdx];
    } else if (type === "ssd") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const sdRef = sfas[sfaIdx].drivers[sdIdx] as any;
      targetNodeRef = (sdRef.sector_specific_drivers || sdRef.sector_drivers)[ssdIdx];
    } else if (type === "kpi") {
      const sdIdx = parseInt(parts[2], 10);
      const ssdIdx = parseInt(parts[3], 10);
      const kpiIdx = parseInt(parts[4], 10);
      const sdRef = sfas[sfaIdx].drivers[sdIdx] as any;
      targetNodeRef = (sdRef.sector_specific_drivers || sdRef.sector_drivers)[ssdIdx].kpis[kpiIdx];
    }
    
    if (targetNodeRef.source_context && targetNodeRef.source_context.custom_parameters) {
      const prevParams = [...targetNodeRef.source_context.custom_parameters];
      const list = [...targetNodeRef.source_context.custom_parameters];
      list.splice(indexToRemove, 1);
      targetNodeRef.source_context.custom_parameters = list;
      
      const updated = { ...treeData, strategic_focus_areas: sfas };
      setTreeData(updated);
      setSelectedNode(prev => prev ? {
        ...prev,
        source_context: targetNodeRef.source_context
      } : null);

      let entityType = "Node";
      if (type === "sfa") entityType = "Strategic Focus Area";
      else if (type === "sd") entityType = "Standard Driver";
      else if (type === "ssd") entityType = "Sector Driver";
      else if (type === "kpi") entityType = "Operational KPI";

      void saveTreeWithAction(
        updated,
        "Update Strategy Traceability",
        entityType,
        selectedNode.name,
        JSON.stringify(prevParams),
        JSON.stringify(list)
      );
    }
  };

  const getAllSsdNodes = () => {
    if (!treeData) return [];
    const list: { uniqueId: string; name: string }[] = [];
    
    treeData.strategic_focus_areas.forEach((sfa, sfaIdx) => {
      sfa.drivers.forEach((sd, sdIdx) => {
        const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
        ssds.forEach((ssd: any, ssdIdx: any) => {
          const uniqueId = `ssd-${sfaIdx}-${sdIdx}-${ssdIdx}`;
          list.push({
            uniqueId,
            name: `[SFA: ${sfa.name.substring(0, 15)}...] → [SD: ${sd.name.substring(0, 15)}...] → ${ssd.name}`
          });
        });
      });
    });
    
    return list;
  };

  // absolute layouter calculations matching Step 3 tree styling
  const calculateLayout = (data: KpiTreeData, offsets: Record<string, { x: number; y: number }> = {}) => {
    const nodes: any[] = [];
    const edges: any[] = [];
    
    const kpiHeight = 44;
    const kpiGap = 68;
    const colWidth = 200;
    const kpiWidth = 340;
    const cardHeight = 60;
    const rootWidth = 100;
    const rootHeight = 90;
    
    let currentY = 60;
    
    const allKpis: any[] = [];
    const allSsds: any[] = [];
    const allSds: any[] = [];
    const allSfas: any[] = [];
    
    data.strategic_focus_areas.forEach((sfa, sfaIdx) => {
      const sfaId = `sfa-${sfaIdx}`;
      allSfas.push({ id: sfaId, name: sfa.name, data: sfa });
      
      if (sfa.collapsed) return;
      
      const sds = sfa.drivers || [];
      sds.forEach((sd, sdIdx) => {
        const sdId = `sd-${sfaIdx}-${sdIdx}`;
        allSds.push({ id: sdId, name: sd.name, parentId: sfaId, data: sd });
        
        if (sd.collapsed) return;
        
        const ssds = sd.sector_specific_drivers || (sd as any).sector_drivers || [];
        ssds.forEach((ssd: any, ssdIdx: any) => {
          const ssdId = `ssd-${sfaIdx}-${sdIdx}-${ssdIdx}`;
          allSsds.push({ id: ssdId, name: ssd.name, parentId: sdId, data: ssd });
          
          if (ssd.collapsed) return;
          
          const kpis = ssd.kpis || [];
          kpis.forEach((kpi: any, kpiIdx: any) => {
            const kpiId = `kpi-${sfaIdx}-${sdIdx}-${ssdIdx}-${kpiIdx}`;
            allKpis.push({ id: kpiId, name: kpi.kpi_name || kpi.name, parentId: ssdId, data: kpi });
          });
        });
      });
    });
    
    // Assign Y coordinates to Col 4 (KPIs)
    const kpiPositions: Record<string, number> = {};
    allKpis.forEach((kpi, idx) => {
      const y = currentY + idx * kpiGap;
      let finalX = 1120;
      let finalY = y;
      if (manualLayout) {
        const absX = kpi.data.x_position !== undefined ? kpi.data.x_position : 1120;
        const absY = kpi.data.y_position !== undefined ? kpi.data.y_position : y;
        finalX = offsets[kpi.id] ? offsets[kpi.id].x : absX;
        finalY = offsets[kpi.id] ? offsets[kpi.id].y : absY;
      } else {
        const offset = offsets[kpi.id] || { x: 0, y: 0 };
        finalX = 1120 + offset.x;
        finalY = y + offset.y;
      }
      kpiPositions[kpi.id] = finalY;
      nodes.push({
        id: kpi.id,
        type: "kpi",
        name: kpi.name,
        x: finalX,
        y: finalY,
        width: kpiWidth,
        height: kpiHeight,
        parentId: kpi.parentId,
        data: kpi.data,
        index: idx + 1
      });
    });
    
    // Assign Y coordinates to Col 3 (SSDs)
    const ssdPositions: Record<string, number> = {};
    allSsds.forEach((ssd) => {
      const childKpis = allKpis.filter(k => k.parentId === ssd.id);
      let y = currentY + (allKpis.length * kpiGap) / 2 - cardHeight / 2;
      if (childKpis.length > 0) {
        const childYs = childKpis.map(k => kpiPositions[k.id] + kpiHeight / 2);
        y = (childYs.reduce((a, b) => a + b, 0) / childYs.length) - cardHeight / 2;
      }
      let finalX = 820;
      let finalY = y;
      if (manualLayout) {
        const absX = ssd.data.x_position !== undefined ? ssd.data.x_position : 820;
        const absY = ssd.data.y_position !== undefined ? ssd.data.y_position : y;
        finalX = offsets[ssd.id] ? offsets[ssd.id].x : absX;
        finalY = offsets[ssd.id] ? offsets[ssd.id].y : absY;
      } else {
        const offset = offsets[ssd.id] || { x: 0, y: 0 };
        finalX = 820 + offset.x;
        finalY = y + offset.y;
      }
      ssdPositions[ssd.id] = finalY;
      nodes.push({
        id: ssd.id,
        type: "ssd",
        name: ssd.name,
        x: finalX,
        y: finalY,
        width: colWidth,
        height: cardHeight,
        parentId: ssd.parentId,
        data: ssd.data
      });
    });
    
    // Assign Y coordinates to Col 2 (SDs)
    const sdPositions: Record<string, number> = {};
    allSds.forEach((sd) => {
      const childSsds = allSsds.filter(s => s.parentId === sd.id);
      let y = currentY + (allKpis.length * kpiGap) / 2 - cardHeight / 2;
      if (childSsds.length > 0) {
        const childYs = childSsds.map(s => ssdPositions[s.id] + cardHeight / 2);
        y = (childYs.reduce((a, b) => a + b, 0) / childYs.length) - cardHeight / 2;
      }
      let finalX = 520;
      let finalY = y;
      if (manualLayout) {
        const absX = sd.data.x_position !== undefined ? sd.data.x_position : 520;
        const absY = sd.data.y_position !== undefined ? sd.data.y_position : y;
        finalX = offsets[sd.id] ? offsets[sd.id].x : absX;
        finalY = offsets[sd.id] ? offsets[sd.id].y : absY;
      } else {
        const offset = offsets[sd.id] || { x: 0, y: 0 };
        finalX = 520 + offset.x;
        finalY = y + offset.y;
      }
      sdPositions[sd.id] = finalY;
      nodes.push({
        id: sd.id,
        type: "sd",
        name: sd.name,
        x: finalX,
        y: finalY,
        width: colWidth,
        height: cardHeight,
        parentId: sd.parentId,
        data: sd.data
      });
    });
    
    // Assign Y coordinates to Col 1 (SFAs)
    const sfaPositions: Record<string, number> = {};
    allSfas.forEach((sfa) => {
      const childSds = allSds.filter(s => s.parentId === sfa.id);
      let y = currentY + (allKpis.length * kpiGap) / 2 - cardHeight / 2;
      if (childSds.length > 0) {
        const childYs = childSds.map(s => sdPositions[s.id] + cardHeight / 2);
        y = (childYs.reduce((a, b) => a + b, 0) / childYs.length) - cardHeight / 2;
      }
      let finalX = 220;
      let finalY = y;
      if (manualLayout) {
        const absX = sfa.data.x_position !== undefined ? sfa.data.x_position : 220;
        const absY = sfa.data.y_position !== undefined ? sfa.data.y_position : y;
        finalX = offsets[sfa.id] ? offsets[sfa.id].x : absX;
        finalY = offsets[sfa.id] ? offsets[sfa.id].y : absY;
      } else {
        const offset = offsets[sfa.id] || { x: 0, y: 0 };
        finalX = 220 + offset.x;
        finalY = y + offset.y;
      }
      sfaPositions[sfa.id] = finalY;
      nodes.push({
        id: sfa.id,
        type: "sfa",
        name: sfa.name,
        x: finalX,
        y: finalY,
        width: colWidth,
        height: cardHeight,
        data: sfa.data
      });
    });
    
    // Assign Y coordinate to Root Circle
    const sfaYs = Object.values(sfaPositions).map(y => y + cardHeight / 2);
    const rootY = sfaYs.length > 0 ? sfaYs.reduce((a, b) => a + b, 0) / sfaYs.length : currentY + (allKpis.length * kpiGap) / 2;
    let rootXVal = 30;
    let rootYVal = rootY;
    if (manualLayout) {
      const absX = (data as any).root_x_position !== undefined ? (data as any).root_x_position : 30;
      const absY = (data as any).root_y_position !== undefined ? (data as any).root_y_position : rootY;
      rootXVal = offsets["root"] ? offsets["root"].x : absX;
      rootYVal = offsets["root"] ? offsets["root"].y : absY;
    } else {
      const offset = offsets["root"] || { x: 0, y: 0 };
      rootXVal = 30 + offset.x;
      rootYVal = rootY + offset.y;
    }
    const rootPos = {
      x: rootXVal,
      y: rootYVal
    };
    nodes.push({
      id: "root",
      type: "root",
      name: "KPI Library",
      x: rootPos.x,
      y: rootPos.y - rootHeight / 2,
      width: rootWidth,
      height: rootHeight,
      data: {}
    });
    
    // Anchor helper functions
    const getNodeAnchorRight = (id: string) => {
      const node = nodes.find(n => n.id === id);
      if (!node) return { x: 0, y: 0 };
      return { x: node.x + node.width, y: node.y + node.height / 2 };
    };

    const getNodeAnchorLeft = (id: string) => {
      const node = nodes.find(n => n.id === id);
      if (!node) return { x: 0, y: 0 };
      return { x: node.x, y: node.y + node.height / 2 };
    };
    
    // Connections from Root to SFAs
    allSfas.forEach(sfa => {
      edges.push({
        id: `root->${sfa.id}`,
        fromId: "root",
        toId: sfa.id,
        from: getNodeAnchorRight("root"),
        to: getNodeAnchorLeft(sfa.id),
        color: "#ffe600"
      });
    });
    
    // Connections from SFAs to SDs
    allSds.forEach(sd => {
      edges.push({
        id: `${sd.parentId}->${sd.id}`,
        fromId: sd.parentId,
        toId: sd.id,
        from: getNodeAnchorRight(sd.parentId),
        to: getNodeAnchorLeft(sd.id),
        color: "#ffe600"
      });
    });
    
    // Connections from SDs to SSDs
    allSsds.forEach(ssd => {
      edges.push({
        id: `${ssd.parentId}->${ssd.id}`,
        fromId: ssd.parentId,
        toId: ssd.id,
        from: getNodeAnchorRight(ssd.parentId),
        to: getNodeAnchorLeft(ssd.id),
        color: "#ffe600"
      });
    });
    
    // Connections from SSDs to KPIs
    allKpis.forEach(kpi => {
      edges.push({
        id: `${kpi.parentId}->${kpi.id}`,
        fromId: kpi.parentId,
        toId: kpi.id,
        from: getNodeAnchorRight(kpi.parentId),
        to: getNodeAnchorLeft(kpi.id),
        color: "#ffe600"
      });
    });
    
    // Dynamically expand layout dimensions to prevent clipping of dragged nodes
    let maxY = 500;
    nodes.forEach(n => {
      if (n.y + n.height + 100 > maxY) {
        maxY = n.y + n.height + 100;
      }
    });
    const height = Math.max(500, maxY);
    
    let maxX = 1120 + kpiWidth + 60;
    nodes.forEach(n => {
      if (n.x + n.width + 100 > maxX) {
        maxX = n.x + n.width + 100;
      }
    });
    const width = Math.max(1520, maxX);
    
    return { nodes, edges, width, height };
  };

  const layout = treeData ? calculateLayout(treeData, nodeOffsets) : { nodes: [], edges: [], width: 1520, height: 600 };
  const isDraft = treeRecord?.status === "draft" || !treeRecord?.status;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <section className="border-l-8 border-[#ffe600] bg-[#1B1B1B] p-7 border border-[#303030] rounded-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FFE600]">Step 06</p>
        <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[#F5F5F5]">KPI Driver Tree Studio</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#B0B0B0]">
          Decompose client strategic objectives into standard drivers, sector-specific drivers, and approved operational KPIs. 
          Provide client strategy-to-KPI traceability and export consulting deliverables.
        </p>

        {/* Client Context Banner */}
        {clientProfile?.client_name && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border border-[#FFE600]/20 bg-[#FFE600]/5 px-4 py-3 rounded-sm">
            <div className="flex items-center gap-2 shrink-0">
              <Building2 size={14} className="text-[#FFE600]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFE600]">Client Context</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#B0B0B0]">
              <span>Client Name: <span className="text-[#F5F5F5] font-semibold">{clientProfile.client_name}</span></span>
              {clientProfile.industry && <span>Industry: <span className="text-[#F5F5F5]">{clientProfile.industry}</span></span>}
              {clientProfile.sub_industry && <span>Sub-Industry: <span className="text-[#F5F5F5]">{clientProfile.sub_industry}</span></span>}
              {clientProfile.region && <span>Region: <span className="text-[#F5F5F5]">{clientProfile.region}</span></span>}
            </div>
          </div>
        )}
      </section>

      {/* Messages */}
      {errorMessage && (
        <div className="flex items-center gap-2 border border-red-500/20 bg-red-500/10 p-4 rounded text-red-400 text-sm">
          <Info size={16} />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-2 border border-green-500/20 bg-green-500/10 p-4 rounded text-green-400 text-sm">
          <Info size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center border border-[#303030] bg-[#1E1E1E] h-[400px] rounded-lg">
          <Loader2 className="animate-spin text-[#FFE600] mb-4" size={40} />
          <p className="text-sm text-[#B0B0B0]">Loading Strategy-to-KPI Traceability Studio...</p>
        </div>
      ) : generating ? (
        <div className="flex flex-col items-center justify-center border border-[#303030] bg-[#1E1E1E] h-[400px] rounded-lg text-center px-4">
          <Loader2 className="animate-spin text-[#FFE600] mb-5" size={48} />
          <h3 className="text-lg font-bold text-white mb-2">Generating KPI Driver Tree</h3>
          <p className="text-sm text-[#B0B0B0] max-w-md animate-pulse">{generationStep}</p>
          <div className="mt-6 w-64 bg-[#303030] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#FFE600] h-full w-1/2 rounded-full animate-[loading_1.5s_infinite_ease-in-out]"></div>
          </div>
        </div>
      ) : !treeData ? (
        <div className="flex flex-col items-center justify-center border border-[#303030] bg-[#1E1E1E] p-12 text-center rounded-lg">
          <Building2 size={48} className="text-[#666] mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No KPI Driver Tree Generated</h3>
          <p className="text-sm text-[#B0B0B0] max-w-lg mb-6">
            Generate a strategy-aligned value driver hierarchy connecting strategic goals to approved operational metrics.
            Gemini will decompose four layers of decomposition client-specifically.
          </p>
          <button 
            onClick={handleGenerate}
            className="flex items-center gap-2 bg-[#FFE600] px-6 py-3 font-semibold text-[#1B1B1B] hover:bg-[#ffe720] transition-colors rounded-sm shadow-md"
          >
            <Zap size={16} />
            Generate KPI Driver Tree
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          {/* Main Workspace (Columns 1-3) */}
          <div className="xl:col-span-3 space-y-4">
            
            {/* Header controls & tools */}
            <div className="flex flex-wrap items-center justify-between gap-4 border border-[#303030] bg-[#1B1B1B] px-4 py-3 rounded-sm">
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider rounded-sm ${
                  isDraft ? "bg-[#B49600]/20 text-[#FFE600] border border-[#B49600]/40" : "bg-green-500/10 text-green-400 border border-green-500/30"
                }`}>
                  {isDraft ? "Draft" : "Approved"}
                </span>
                <span className="text-xs text-[#B0B0B0]">
                  Version: <span className="font-semibold text-white">{treeRecord?.version || 1}</span>
                </span>
                {treeRecord?.updated_at && (
                  <span className="text-xs text-[#666]">
                    Updated: {new Date(treeRecord.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {isDraft ? (
                  <>
                    <button 
                      onClick={handleAddSfa}
                      className="flex items-center gap-1.5 border border-[#FFE600]/40 hover:border-[#FFE600] bg-transparent text-[#FFE600] px-3 py-1.5 text-xs font-bold rounded-sm transition-colors"
                    >
                      <Plus size={13} />
                      Add Focus Area
                    </button>
                    <button 
                      onClick={handleSave}
                      className="flex items-center gap-1.5 bg-[#FFE600] text-[#1B1B1B] hover:bg-[#ffe720] px-4 py-1.5 text-xs font-bold rounded-sm transition-colors"
                    >
                      Save Tree
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm("Are you sure you want to regenerate the tree? All custom nodes and modifications will be replaced.")) {
                          void handleGenerate();
                        }
                      }}
                      className="flex items-center gap-1.5 border border-[#303030] hover:border-[#555] bg-transparent text-white px-3 py-1.5 text-xs font-bold rounded-sm transition-colors"
                    >
                      Regenerate
                    </button>
                    <button 
                      onClick={() => handleApproveStatus(true)}
                      className="flex items-center gap-1.5 border border-green-500/40 hover:border-green-500 bg-transparent text-green-400 px-3 py-1.5 text-xs font-bold rounded-sm transition-colors"
                    >
                      <Check size={13} />
                      Approve Tree
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => handleApproveStatus(false)}
                      className="flex items-center gap-1.5 border border-amber-500/40 hover:border-amber-500 bg-transparent text-amber-400 px-3 py-1.5 text-xs font-bold rounded-sm transition-colors"
                    >
                      Reopen Tree
                    </button>
                    <a 
                      href={exportUrl("kpi_driver_tree", "pdf")}
                      download
                      className="flex items-center gap-1.5 bg-[#FFE600] text-[#1B1B1B] hover:bg-[#ffe720] px-4 py-1.5 text-xs font-bold rounded-sm transition-colors"
                    >
                      <Download size={13} />
                      Export PDF
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Canvas Toolbar & Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#111111] p-3 border border-[#303030] rounded-sm">
              {/* Pan & Zoom Controls */}
              <div className="flex items-center gap-1 border border-[#303030] bg-[#1E1E1E] p-1 rounded-sm">
                <button 
                  onClick={zoomIn} 
                  title="Zoom In"
                  className="p-1.5 text-[#B0B0B0] hover:text-white hover:bg-[#303030] rounded-sm transition-colors"
                >
                  <ZoomIn size={14} />
                </button>
                <button 
                  onClick={zoomOut} 
                  title="Zoom Out"
                  className="p-1.5 text-[#B0B0B0] hover:text-white hover:bg-[#303030] rounded-sm transition-colors"
                >
                  <ZoomOut size={14} />
                </button>
                <button 
                  onClick={resetZoom} 
                  title="Reset Workspace"
                  className="p-1.5 text-[#B0B0B0] hover:text-white hover:bg-[#303030] rounded-sm transition-colors text-[10px] font-bold"
                >
                  100%
                </button>
                <button 
                  onClick={fitToScreen} 
                  title="Fit to Screen"
                  className="p-1.5 text-[#B0B0B0] hover:text-white hover:bg-[#303030] rounded-sm transition-colors border-r border-[#303030] pr-2.5 mr-1"
                >
                  <Maximize size={14} />
                </button>
                <button 
                  onClick={handleToggleManualLayout} 
                  title={manualLayout ? "Switch to Auto Layout" : "Switch to Manual Layout"}
                  className={`px-2.5 py-1 text-[10px] font-black tracking-wider rounded-sm transition-all duration-300 flex items-center gap-1.5 ${
                    manualLayout 
                      ? "bg-[#FFE600] text-[#1B1B1B] shadow-[0_0_10px_rgba(255,230,0,0.2)]" 
                      : "text-[#B0B0B0] hover:text-white hover:bg-[#303030]"
                  }`}
                >
                  <Zap size={10} className={manualLayout ? "animate-pulse" : ""} />
                  {manualLayout ? "MANUAL LAYOUT" : "AUTO LAYOUT"}
                </button>
              </div>

              {/* KPI Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search KPIs inside tree..." 
                  className="w-full bg-[#1E1E1E] border border-[#303030] pl-9 pr-4 py-1.5 text-xs text-white rounded-sm focus:outline-none focus:border-[#FFE600] transition-colors"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Tree Canvas Board */}
            <div 
              ref={canvasWrapperRef}
              className="relative w-full h-[650px] border border-[#303030] bg-[#111111] overflow-hidden rounded-md cursor-grab active:cursor-grabbing"
              onMouseDown={handleMouseDown}
            >
              {/* Zoom & Pan Transform Container */}
              <div 
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: "0 0",
                  transition: isPanning ? "none" : "transform 0.15s cubic-bezier(0.1, 0.8, 0.25, 1)",
                  width: layout.width + 100,
                  height: layout.height + 100
                }}
                className="absolute top-0 left-0 select-none"
              >
                <svg 
                  className="absolute top-0 left-0 pointer-events-none z-0" 
                  width={layout.width + 100}
                  height={layout.height + 100}
                  viewBox={`0 0 ${layout.width + 100} ${layout.height + 100}`}
                  style={{ 
                    width: layout.width + 100, 
                    height: layout.height + 100,
                    maxWidth: "none",
                    maxHeight: "none"
                  }}
                >
                  <defs>
                    <filter id="shadow-glow" x="-10%" y="-10%" width="120%" height="120%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feColorMatrix type="matrix" values="1 0 0 0 1  0 1 0 0 0.9  0 0 1 0 0  0 0 0 0.5 0" />
                      <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    
                    <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <circle cx="2" cy="2" r="1" fill="#FFE600" fillOpacity="0.04" />
                    </pattern>
                  </defs>
 
                  {/* Dot Grid Background */}
                  <rect width="100%" height="100%" fill="url(#dotGrid)" />
 
                  {layout.edges.map(edge => {
                    const dx = Math.abs(edge.to.x - edge.from.x) * 0.45;
                    const dStr = `M ${edge.from.x} ${edge.from.y} C ${edge.from.x + dx} ${edge.from.y}, ${edge.to.x - dx} ${edge.to.y}, ${edge.to.x} ${edge.to.y}`;
                    const isHigh = !isAnyHovered || (isSameBranch(edge.fromId, hoveredNodeId!) && isSameBranch(edge.toId, hoveredNodeId!));
                    return (
                      <path 
                        key={edge.id}
                        d={dStr}
                        stroke={isHigh ? "#FFE600" : "rgba(255, 230, 0, 0.12)"}
                        strokeWidth={isHigh ? 2.5 : 1.25}
                        fill="none"
                        filter={isHigh ? "url(#shadow-glow)" : undefined}
                        className="transition-all duration-300"
                      />
                    );
                  })}
                </svg>

                {/* DOM Nodes representation */}
                <div className="absolute top-0 left-0 z-10" style={{ width: layout.width, height: layout.height }}>
                  {/* Column Labels */}
                  <div className="absolute top-2 left-0 flex text-[10px] font-black uppercase tracking-widest text-[#FFE600]/80">
                    <span className="absolute left-[30px] w-[100px] text-center">Root Source</span>
                    <span className="absolute left-[220px] w-[200px] text-center">Strategic Focus Area</span>
                    <span className="absolute left-[520px] w-[200px] text-center">Standard Driver</span>
                    <span className="absolute left-[820px] w-[200px] text-center">Sector Driver</span>
                    <span className="absolute left-[1120px] w-[340px] text-center">Operational KPI</span>
                  </div>

                  {layout.nodes.map(node => {
                    const isSelected = selectedNode?.id === node.id;
                    const isKpi = node.type === "kpi";
                    
                    const isMatch = searchQuery 
                      ? node.name.toLowerCase().includes(searchQuery.toLowerCase())
                      : false;
                      
                    // Render Root Circle Node
                    if (node.type === "root") {
                      return (
                        <div 
                          key={node.id}
                          className="absolute flex items-center justify-center transition-all duration-300"
                          style={{ 
                            left: `${node.x}px`, 
                            top: `${node.y}px`,
                            width: `${node.width}px`,
                            height: `${node.height}px`
                          }}
                        >
                          <div 
                            className="w-full h-full rounded-full flex flex-col items-center justify-center text-center p-3 font-black text-[10px] uppercase tracking-wider select-none transition-all duration-300 bg-[#FFE600] text-black shadow-[0_0_20px_rgba(255,230,0,0.25)] border-4 border-black/10"
                          >
                            <FileText className="w-4 h-4 mb-0.5" />
                            <span>KPI Library</span>
                          </div>
                        </div>
                      );
                    }

                    // Render KPI Card Node
                    if (isKpi) {
                      const label = `KPI-${String(node.index).padStart(3, '0')}`;
                      const isHigh = isNodeHigh(node.id);
                      return (
                        <div
                          key={node.id}
                          onMouseDown={(e) => handleKpiMouseDown(e, node.id)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode({
                              id: node.id,
                              type: node.type,
                              name: node.name,
                              description: node.data.kpi_description || node.data.description || "",
                              business_rationale: "",
                              source_context: node.data.source_context || {
                                strategic_objectives: [],
                                business_challenges: [],
                                kras: [],
                                functional_areas: [],
                                custom_parameters: []
                              },
                              originalRef: node.data
                            });
                          }}
                          onMouseEnter={() => setHoveredNodeId(node.id)}
                          onMouseLeave={() => setHoveredNodeId(null)}
                          style={{
                            left: `${node.x}px`,
                            top: `${node.y}px`,
                            width: `${node.width}px`,
                            height: `${node.height}px`
                          }}
                          className={`absolute group flex items-center gap-2.5 px-3 border rounded-sm no-pan ${
                            draggingNodeId === node.id
                              ? "bg-[#FFE600]/25 border-[#FFE600] ring-2 ring-[#FFE600]/50 scale-[1.03] shadow-[0_0_15px_rgba(255,230,0,0.35)] z-50 cursor-grabbing transition-none"
                              : isSelected 
                              ? "bg-[#FFE600]/10 border-[#FFE600] ring-1 ring-[#FFE600] cursor-grab transition-all duration-300" 
                              : isMatch 
                              ? "bg-green-500/10 border-green-500 ring-2 ring-green-500/50 animate-pulse cursor-grab transition-all duration-300" 
                              : isHigh
                              ? "bg-[#111111] border-[#FFE600] text-[#FFE600] shadow-[0_0_8px_rgba(255,230,0,0.1)] cursor-grab transition-all duration-300"
                              : "bg-[#0A0A0A] border-[#303030]/60 text-gray-500 opacity-60 cursor-grab transition-all duration-300"
                          } hover:border-[#FFE600]/80`}
                        >
                          <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm shrink-0 border transition-all duration-300 ${
                            isHigh 
                              ? "bg-yellow-950/40 border-yellow-800 text-yellow-400"
                              : "bg-gray-900 border-transparent text-gray-600"
                          }`}>
                            {label}
                          </span>
                          <span className="text-[10px] font-semibold truncate flex-1 font-sans text-left">
                            {node.name}
                          </span>

                          {isDraft && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                              title="Delete KPI"
                              className="p-1 opacity-0 group-hover:opacity-100 bg-[#222] hover:bg-red-500 hover:text-white text-gray-400 rounded transition-all"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      );
                    }

                    // Render SFA, SD, or SSD Category Node
                    let subtitle = "";
                    if (node.type === "sfa") {
                      const count = node.data.drivers?.length || 0;
                      subtitle = `${count} ${count === 1 ? 'Driver' : 'Drivers'}`;
                    } else if (node.type === "sd") {
                      const sdRef = node.data as any;
                      const count = (sdRef.sector_specific_drivers || sdRef.sector_drivers || []).length;
                      subtitle = `${count} ${count === 1 ? 'Sector Driver' : 'Sector Drivers'}`;
                    } else if (node.type === "ssd") {
                      const count = node.data.kpis?.length || 0;
                      subtitle = `${count} ${count === 1 ? 'KPI' : 'KPIs'}`;
                    }

                    const isHigh = isNodeHigh(node.id);

                    return (
                      <div
                        key={node.id}
                        onMouseDown={(e) => handleKpiMouseDown(e, node.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode({
                            id: node.id,
                            type: node.type,
                            name: node.name,
                            description: node.data.description || "",
                            business_rationale: node.data.business_rationale || "",
                            source_context: node.data.source_context || {
                              strategic_objectives: [],
                              business_challenges: [],
                              kras: [],
                              functional_areas: [],
                              custom_parameters: []
                            },
                            originalRef: node.data
                          });
                        }}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        style={{
                          left: `${node.x}px`,
                          top: `${node.y}px`,
                          width: `${node.width}px`,
                          height: `${node.height}px`
                        }}
                        className={`absolute group border rounded-md p-3 flex flex-col justify-center text-center shadow-md no-pan ${
                          draggingNodeId === node.id
                            ? 'bg-[#FFE600]/25 border-[#FFE600] text-[#FFE600] ring-2 ring-[#FFE600]/50 scale-[1.03] shadow-[0_0_15px_rgba(255,230,0,0.35)] z-50 cursor-grabbing transition-none'
                            : isSelected 
                            ? 'bg-[#FFE600]/10 border-[#FFE600] text-[#FFE600] shadow-[0_0_15px_rgba(255,230,0,0.25)] ring-1 ring-[#FFE600] cursor-grab transition-all duration-300' 
                            : isHigh
                            ? 'bg-[#1B1B1B] border-[#FFE600] text-[#FFE600] shadow-[0_0_12px_rgba(255,230,0,0.15)] cursor-grab transition-all duration-300'
                            : 'bg-[#151515] border-[#303030]/60 text-gray-500 opacity-60 cursor-grab transition-all duration-300'
                        } hover:border-[#FFE600]/80`}
                      >
                        {/* Collapse/Expand Toggle Button */}
                        <button
                          onClick={(e) => handleToggleCollapse(e, node.id)}
                          onMouseDown={(e) => e.stopPropagation()} // Prevent drag start when clicking chevron
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-500 hover:text-[#FFE600] rounded hover:bg-[#252525] transition-colors z-10"
                          title={node.data.collapsed ? "Expand branch" : "Collapse branch"}
                        >
                          {node.data.collapsed ? (
                            <ChevronRight size={11} />
                          ) : (
                            <ChevronDown size={11} />
                          )}
                        </button>

                        <span className="text-[10px] font-bold tracking-wide uppercase truncate pl-4">
                          {node.name}
                        </span>
                        <span className="text-[8px] font-medium uppercase mt-0.5 text-[#B0B0B0] pl-4">
                          {subtitle}
                        </span>

                        {/* Hover Overlay Controls (Draft mode only) */}
                        {isDraft && (
                          <div className="absolute -top-2.5 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1B1B1B] p-0.5 border border-[#303030] rounded shadow-md z-20">
                            {node.type === "sfa" && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleAddSd(parseInt(node.id.split("-")[1], 10)); }}
                                title="Add Standard Driver"
                                className="p-1 bg-[#252525] hover:bg-[#FFE600] hover:text-[#1B1B1B] text-[#FFE600] rounded transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            )}
                            {node.type === "sd" && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const parts = node.id.split("-");
                                  handleAddSsd(parseInt(parts[1], 10), parseInt(parts[2], 10));
                                }}
                                title="Add Sector Driver"
                                className="p-1 bg-[#252525] hover:bg-[#FFE600] hover:text-[#1B1B1B] text-[#FFE600] rounded transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            )}
                            {node.type === "ssd" && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const parts = node.id.split("-");
                                  handleAddKpi(parseInt(parts[1], 10), parseInt(parts[2], 10), parseInt(parts[3], 10));
                                }}
                                title="Add KPI"
                                className="p-1 bg-[#252525] hover:bg-[#FFE600] hover:text-[#1B1B1B] text-[#FFE600] rounded transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                              title="Delete Node"
                              className="p-1 bg-[#252525] hover:bg-red-500 hover:text-white text-gray-400 rounded transition-colors"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Node Inspector Drawer Panel (Column 4) */}
          <div className="xl:col-span-1 border border-[#303030] bg-[#1B1B1B] p-4 rounded-sm space-y-5 h-full min-h-[600px]">
            {selectedNode ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[#303030] pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFE600]">
                      Node Inspector
                    </span>
                    <h3 className="text-sm font-bold text-white capitalize">
                      {selectedNode.type === "sfa" && "Strategic Focus Area"}
                      {selectedNode.type === "sd" && "Standard Driver"}
                      {selectedNode.type === "ssd" && "Sector Driver"}
                      {selectedNode.type === "kpi" && "Operational KPI"}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setSelectedNode(null)}
                    className="text-[#666] hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Node Metadata editor details */}
                <div className="space-y-3.5">
                  <div>
                    <input 
                      type="text" 
                      value={selectedNode.name}
                      onChange={(e) => handleUpdateNodeFields({ name: e.target.value })}
                      onFocus={(e) => {
                        initialEditValueRef.current = e.target.value;
                      }}
                      onBlur={(e) => {
                        const finalVal = e.target.value.trim();
                        const initialVal = initialEditValueRef.current.trim();
                        if (finalVal && finalVal !== initialVal) {
                          let action = "Rename Node";
                          let entityType = "Node";
                          if (selectedNode.type === "sfa") {
                            action = "Rename Strategic Focus Area";
                            entityType = "Strategic Focus Area";
                          } else if (selectedNode.type === "sd") {
                            action = "Rename Standard Driver";
                            entityType = "Standard Driver";
                          } else if (selectedNode.type === "ssd") {
                            action = "Rename Sector Driver";
                            entityType = "Sector Driver";
                          } else if (selectedNode.type === "kpi") {
                            action = "Rename Operational KPI";
                            entityType = "Operational KPI";
                          }
                          void saveTreeWithAction(treeData, action, entityType, finalVal, initialVal, finalVal);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                      }}
                      className="w-full bg-[#252525] border border-[#333] px-3 py-1.5 text-xs text-white rounded focus:outline-none focus:border-[#FFE600]"
                    />
                  </div>

                  <div>
                    <textarea 
                      rows={3}
                      value={selectedNode.description}
                      onChange={(e) => handleUpdateNodeFields({ description: e.target.value })}
                      onFocus={(e) => {
                        initialEditValueRef.current = e.target.value;
                      }}
                      onBlur={(e) => {
                        const finalVal = e.target.value.trim();
                        const initialVal = initialEditValueRef.current.trim();
                        if (finalVal !== initialVal) {
                          let entityType = "Node";
                          if (selectedNode.type === "sfa") entityType = "Strategic Focus Area";
                          else if (selectedNode.type === "sd") entityType = "Standard Driver";
                          else if (selectedNode.type === "ssd") entityType = "Sector Driver";
                          else if (selectedNode.type === "kpi") entityType = "Operational KPI";
                          void saveTreeWithAction(treeData, "Edit Description", entityType, selectedNode.name, initialVal, finalVal);
                        }
                      }}
                      className="w-full bg-[#252525] border border-[#333] px-3 py-1.5 text-xs text-white rounded focus:outline-none focus:border-[#FFE600] resize-none"
                    />
                  </div>

                    <div>
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                        Business Rationale
                      </label>
                      <textarea 
                        rows={3}
                        value={selectedNode.business_rationale}
                        onChange={(e) => handleUpdateNodeFields({ business_rationale: e.target.value })}
                        onFocus={(e) => {
                          initialEditValueRef.current = e.target.value;
                        }}
                        onBlur={(e) => {
                          const finalVal = e.target.value.trim();
                          const initialVal = initialEditValueRef.current.trim();
                          if (finalVal !== initialVal) {
                            let entityType = "Node";
                            if (selectedNode.type === "sfa") entityType = "Strategic Focus Area";
                            else if (selectedNode.type === "sd") entityType = "Standard Driver";
                            else if (selectedNode.type === "ssd") entityType = "Sector Driver";
                            else if (selectedNode.type === "kpi") entityType = "Operational KPI";
                            void saveTreeWithAction(treeData, "Edit Business Rationale", entityType, selectedNode.name, initialVal, finalVal);
                          }
                        }}
                        className="w-full bg-[#252525] border border-[#333] px-3 py-1.5 text-xs text-white rounded focus:outline-none focus:border-[#FFE600] resize-none"
                      />
                    </div>

                  {selectedNode.type === "kpi" && (
                    <div className="border border-[#FFE600]/20 bg-[#FFE600]/5 p-3 rounded">
                      <label className="text-[10px] font-semibold text-[#FFE600] uppercase tracking-wider block mb-1.5">
                        Move KPI to Driver branch
                      </label>
                      <select 
                        onChange={(e) => {
                          if (e.target.value) {
                            handleMoveKpi(e.target.value);
                            e.target.value = "";
                          }
                        }}
                        className="w-full bg-[#1B1B1B] border border-[#FFE600]/40 text-xs text-white p-1 rounded focus:outline-none"
                      >
                        <option value="">-- Choose target Sector Driver --</option>
                        {getAllSsdNodes().map(ssd => (
                          <option key={ssd.uniqueId} value={ssd.uniqueId}>
                            {ssd.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Context Traceability mapping panel */}
                  <div className="border-t border-[#303030] pt-3">
                    <label className="text-[10px] font-bold text-[#FFE600] uppercase tracking-wider block mb-2.5">
                      Strategy Traceability Context
                    </label>

                    {businessContext ? (
                      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                        
                        {/* Objectives mapping */}
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                            Strategic Objectives
                          </p>
                          <div className="flex flex-col gap-1">
                            {businessContext.business_priorities.map((item, idx) => {
                              const checked = selectedNode.source_context?.strategic_objectives?.includes(item);
                              return (
                                <button
                                  key={idx}
                                  disabled={false}
                                  onClick={() => handleToggleSourceContext("strategic_objectives", item)}
                                  className={`flex items-start text-left gap-2 text-[10px] px-2 py-1 border transition-colors rounded-sm ${
                                    checked 
                                      ? "bg-[#FFE600]/10 border-[#FFE600]/40 text-white" 
                                      : "bg-[#252525]/50 border-transparent text-[#B0B0B0]"
                                  }`}
                                >
                                  {checked ? <Check size={11} className="text-[#FFE600] shrink-0 mt-0.5" /> : <div className="w-2.5 h-2.5 border border-gray-600 rounded-sm shrink-0 mt-0.5" />}
                                  <span>{item}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Challenges mapping */}
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                            Business Challenges
                          </p>
                          <div className="flex flex-col gap-1">
                            {businessContext.business_challenges.map((item, idx) => {
                              const checked = selectedNode.source_context?.business_challenges?.includes(item);
                              return (
                                <button
                                  key={idx}
                                  disabled={false}
                                  onClick={() => handleToggleSourceContext("business_challenges", item)}
                                  className={`flex items-start text-left gap-2 text-[10px] px-2 py-1 border transition-colors rounded-sm ${
                                    checked 
                                      ? "bg-[#FFE600]/10 border-[#FFE600]/40 text-white" 
                                      : "bg-[#252525]/50 border-transparent text-[#B0B0B0]"
                                  }`}
                                >
                                  {checked ? <Check size={11} className="text-[#FFE600] shrink-0 mt-0.5" /> : <div className="w-2.5 h-2.5 border border-gray-600 rounded-sm shrink-0 mt-0.5" />}
                                  <span>{item}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* KRAs mapping */}
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                            Key Result Areas (KRAs)
                          </p>
                          <div className="flex flex-col gap-1">
                            {businessContext.top_kras.map((item, idx) => {
                              const checked = selectedNode.source_context?.kras?.includes(item);
                              return (
                                <button
                                  key={idx}
                                  disabled={false}
                                  onClick={() => handleToggleSourceContext("kras", item)}
                                  className={`flex items-start text-left gap-2 text-[10px] px-2 py-1 border transition-colors rounded-sm ${
                                    checked 
                                      ? "bg-[#FFE600]/10 border-[#FFE600]/40 text-white" 
                                      : "bg-[#252525]/50 border-transparent text-[#B0B0B0]"
                                  }`}
                                >
                                  {checked ? <Check size={11} className="text-[#FFE600] shrink-0 mt-0.5" /> : <div className="w-2.5 h-2.5 border border-gray-600 rounded-sm shrink-0 mt-0.5" />}
                                  <span>{item}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Functional Areas mapping */}
                        <div>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                            Functional Areas
                          </p>
                          <div className="flex flex-col gap-1">
                            {businessContext.functional_areas.map((item, idx) => {
                              const checked = selectedNode.source_context?.functional_areas?.includes(item);
                              return (
                                <button
                                  key={idx}
                                  disabled={false}
                                  onClick={() => handleToggleSourceContext("functional_areas", item)}
                                  className={`flex items-start text-left gap-2 text-[10px] px-2 py-1 border transition-colors rounded-sm ${
                                    checked 
                                      ? "bg-[#FFE600]/10 border-[#FFE600]/40 text-white" 
                                      : "bg-[#252525]/50 border-transparent text-[#B0B0B0]"
                                  }`}
                                >
                                  {checked ? <Check size={11} className="text-[#FFE600] shrink-0 mt-0.5" /> : <div className="w-2.5 h-2.5 border border-gray-600 rounded-sm shrink-0 mt-0.5" />}
                                  <span>{item}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Custom fields mapping */}
                        {businessContext.custom_fields && businessContext.custom_fields.length > 0 && (
                          <div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                              Custom Parameters
                            </p>
                            <div className="flex flex-col gap-1">
                              {businessContext.custom_fields.map((f, idx) => {
                                const valStr = `${f.label}: ${f.value}`;
                                const checked = selectedNode.source_context?.custom_parameters?.includes(valStr);
                                return (
                                  <button
                                    key={idx}
                                    disabled={false}
                                    onClick={() => handleToggleSourceContext("custom_parameters", valStr)}
                                    className={`flex items-start text-left gap-2 text-[10px] px-2 py-1 border transition-colors rounded-sm ${
                                      checked 
                                        ? "bg-[#FFE600]/10 border-[#FFE600]/40 text-white" 
                                        : "bg-[#252525]/50 border-transparent text-[#B0B0B0]"
                                    }`}
                                  >
                                    {checked ? <Check size={11} className="text-[#FFE600] shrink-0 mt-0.5" /> : <div className="w-2.5 h-2.5 border border-gray-600 rounded-sm shrink-0 mt-0.5" />}
                                    <span>{valStr}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500">Business context is empty.</p>
                    )}

                    {/* Node-Specific Custom Parameters Section */}
                    <div className="border-t border-[#303030] pt-3 mt-3">
                      <label className="text-[10px] font-bold text-[#FFE600] uppercase tracking-wider block mb-2">
                        Node Custom Parameters
                      </label>
                      
                      {/* List existing custom parameters */}
                      <div className="space-y-1.5 mb-3">
                        {selectedNode.source_context?.custom_parameters && selectedNode.source_context.custom_parameters.length > 0 ? (
                          selectedNode.source_context.custom_parameters.map((param, pIdx) => {
                            const colonIdx = param.indexOf(":");
                            const label = colonIdx > -1 ? param.substring(0, colonIdx).trim() : param;
                            const value = colonIdx > -1 ? param.substring(colonIdx + 1).trim() : "";
                            
                            return (
                              <div key={pIdx} className="flex items-center justify-between bg-[#252525] px-2.5 py-1.5 rounded-sm border border-[#333]">
                                <div className="text-[11px] truncate mr-2">
                                  <span className="text-[#FFE600] font-semibold">{label}:</span>{" "}
                                  <span className="text-white">{value}</span>
                                </div>
                                <button
                                  onClick={() => handleRemoveNodeCustomParam(pIdx)}
                                  className="text-gray-500 hover:text-red-400 p-0.5 transition-colors"
                                  title="Delete custom parameter"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-[10px] text-gray-500 italic">No custom parameters added yet.</p>
                        )}
                      </div>

                      {/* Add new custom parameter form */}
                      <div className="space-y-2 border border-[#303030] p-2 bg-[#252525]/30 rounded-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Name"
                            value={newParamName}
                            onChange={(e) => setNewParamName(e.target.value)}
                            className="bg-[#1A1A1A] border border-[#333] px-2 py-1 text-[11px] text-white rounded focus:outline-none focus:border-[#FFE600] w-full"
                          />
                          <input
                            type="text"
                            placeholder="Value"
                            value={newParamValue}
                            onChange={(e) => setNewParamValue(e.target.value)}
                            className="bg-[#1A1A1A] border border-[#333] px-2 py-1 text-[11px] text-white rounded focus:outline-none focus:border-[#FFE600] w-full"
                          />
                        </div>
                        <button
                          onClick={handleAddNodeCustomParam}
                          className="w-full bg-[#FFE600]/20 border border-[#FFE600]/40 text-[#FFE600] hover:bg-[#FFE600] hover:text-black font-bold py-1 px-2 text-[10px] rounded transition-colors"
                        >
                          Add Parameter
                        </button>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleSave}
                    className="w-full bg-[#303030] hover:bg-[#444] text-white border border-[#444] px-4 py-2 text-xs font-bold rounded-sm transition-colors mt-2"
                  >
                    Save Tree Changes
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center h-[500px] text-gray-500 space-y-2.5">
                <Info size={24} className="text-gray-600" />
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">No Node Selected</h4>
                  <p className="text-[11px] text-gray-500 max-w-[200px] mt-1 leading-normal">
                    Click any node in the driver tree to inspect its description, business rationale, and strategy traceability source context.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
