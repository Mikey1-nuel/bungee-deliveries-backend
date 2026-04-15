import { pool } from "../../config/db";

export const logAction = async ({
  userId,
  action,
  entity,
  entityId,
  metadata,
}: any) => {
  await pool.query(
    `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, entity, entityId, metadata]
  );
};
