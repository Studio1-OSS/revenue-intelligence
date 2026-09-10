CREATE TRIGGER signals_health_insert AFTER INSERT ON signals BEGIN
  UPDATE companies SET health=MAX(0,MIN(100,75-15*(SELECT COUNT(*) FROM signals WHERE company_id=new.company_id AND workspace_id=new.workspace_id AND kind='risk' AND status='open')+5*(SELECT COUNT(*) FROM signals WHERE company_id=new.company_id AND workspace_id=new.workspace_id AND kind='expansion' AND status='open'))) WHERE id=new.company_id AND workspace_id=new.workspace_id;
END;
CREATE TRIGGER signals_health_update AFTER UPDATE OF status ON signals BEGIN
  UPDATE companies SET health=MAX(0,MIN(100,75-15*(SELECT COUNT(*) FROM signals WHERE company_id=new.company_id AND workspace_id=new.workspace_id AND kind='risk' AND status='open')+5*(SELECT COUNT(*) FROM signals WHERE company_id=new.company_id AND workspace_id=new.workspace_id AND kind='expansion' AND status='open'))) WHERE id=new.company_id AND workspace_id=new.workspace_id;
END;
CREATE TRIGGER signals_health_delete AFTER DELETE ON signals BEGIN
  UPDATE companies SET health=MAX(0,MIN(100,75-15*(SELECT COUNT(*) FROM signals WHERE company_id=old.company_id AND workspace_id=old.workspace_id AND kind='risk' AND status='open')+5*(SELECT COUNT(*) FROM signals WHERE company_id=old.company_id AND workspace_id=old.workspace_id AND kind='expansion' AND status='open'))) WHERE id=old.company_id AND workspace_id=old.workspace_id;
END;
