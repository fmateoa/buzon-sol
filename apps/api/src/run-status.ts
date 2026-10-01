/**
 * Latest inventory run (`lr`) and latest complete run (`lc`) of the account aliased `a`. Persisted state only:
 * listing accounts never contacts SUNAT.
 */
export const RUN_STATUS_JOINS = `LEFT JOIN sync_runs lr ON lr.id=(SELECT id FROM sync_runs WHERE account_id=a.id
    ORDER BY COALESCE(started_at,'9999-12-31') DESC,id DESC LIMIT 1)
  LEFT JOIN sync_runs lc ON lc.id=(SELECT id FROM sync_runs WHERE account_id=a.id AND state='complete'
    ORDER BY finished_at DESC,id DESC LIMIT 1)`;
export const RUN_STATUS_COLUMNS = `lr.state AS runState,lr.started_at AS runStartedAt,lr.finished_at AS runFinishedAt,
  lr.resume_box AS runBox,lr.resume_page AS runPage,lc.finished_at AS lastCompleteAt,
  COALESCE(lc.new_messages,0) AS newMessages,COALESCE(lc.new_notifications,0) AS newNotifications`;
