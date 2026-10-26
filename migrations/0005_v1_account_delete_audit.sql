CREATE TRIGGER account_deletion_audit AFTER DELETE ON user
BEGIN
 INSERT INTO admin_audit(id,actor,action,target,reason,before,after,created_at)
 VALUES(lower(hex(randomblob(16))),'self-service','account-deleted',OLD.id,'Account deletion',NULL,NULL,CAST(unixepoch('subsec')*1000 AS INTEGER));
END;
