const pool = require('../../db/pool');

async function listCustomers(filters = {}){
  const values = [];
  const where = [];

  if(filters.q){
    values.push(`%${String(filters.q).trim()}%`);
    const idx = values.length;
    where.push(`(
      c.display_name ILIKE $${idx}
      OR c.company_name ILIKE $${idx}
      OR pc.first_name ILIKE $${idx}
      OR pc.last_name ILIKE $${idx}
      OR pc.phone ILIKE $${idx}
      OR pc.email ILIKE $${idx}
      OR pl.address_line_1 ILIKE $${idx}
      OR pl.city ILIKE $${idx}
    )`);
  }

  if(filters.status_code){
    values.push(filters.status_code);
    where.push(`cs.code = $${values.length}`);
  }

  if(filters.service_line_id){
    values.push(Number(filters.service_line_id));
    where.push(`EXISTS (
      SELECT 1
      FROM customer_service_lines csl_filter
      WHERE csl_filter.customer_id = c.id
        AND csl_filter.service_line_id = $${values.length}
        AND csl_filter.is_active = true
    )`);
  }

  if(filters.assigned_user_id){
    values.push(Number(filters.assigned_user_id));
    where.push(`c.assigned_user_id = $${values.length}`);
  }

  if(filters.lead_source_id){
    values.push(Number(filters.lead_source_id));
    where.push(`c.lead_source_id = $${values.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const r = await pool.query(`
    SELECT
      c.id,
      c.display_name,
      c.company_name,
      c.created_at,
      cs.code status_code,
      cs.name status,
      ls.name lead_source,
      owner.display_name assigned_to,
      string_agg(DISTINCT sl.name, ', ' ORDER BY sl.name) services,
      pc.phone,
      pc.email,
      pl.address_line_1,
      pl.city,
      pl.state
    FROM customers c
    JOIN customer_statuses cs ON cs.id = c.customer_status_id
    LEFT JOIN lead_sources ls ON ls.id = c.lead_source_id
    LEFT JOIN users owner ON owner.id = c.assigned_user_id
    LEFT JOIN customer_contacts pc ON pc.customer_id = c.id AND pc.is_primary = true
    LEFT JOIN customer_locations pl ON pl.customer_id = c.id AND pl.is_primary = true
    LEFT JOIN customer_service_lines csl ON csl.customer_id = c.id AND csl.is_active = true
    LEFT JOIN service_lines sl ON sl.id = csl.service_line_id
    ${whereSql}
    GROUP BY c.id,c.display_name,c.company_name,c.created_at,cs.code,cs.name,ls.name,owner.display_name,pc.phone,pc.email,pl.address_line_1,pl.city,pl.state
    ORDER BY c.updated_at DESC, c.id DESC
  `, values);
  return r.rows;
}

async function getCustomerDetail(id){
  const cr=await pool.query(`SELECT c.*,cs.code status_code,cs.name status,ls.name lead_source,u.display_name assigned_to FROM customers c JOIN customer_statuses cs ON cs.id=c.customer_status_id LEFT JOIN lead_sources ls ON ls.id=c.lead_source_id LEFT JOIN users u ON u.id=c.assigned_user_id WHERE c.id=$1`,[id]);
  if(!cr.rows[0]) return null;
  const [contacts,locations,services,assets,notes,workOrders,estimates,invoices,statusHistory,activity]=await Promise.all([
    pool.query(`SELECT * FROM customer_contacts WHERE customer_id=$1 ORDER BY is_primary DESC,id`,[id]),
    pool.query(`SELECT cl.*,pt.name property_type FROM customer_locations cl LEFT JOIN property_types pt ON pt.id=cl.property_type_id WHERE cl.customer_id=$1 ORDER BY cl.is_primary DESC,cl.id`,[id]),
    pool.query(`SELECT sl.* FROM customer_service_lines csl JOIN service_lines sl ON sl.id=csl.service_line_id WHERE csl.customer_id=$1 AND csl.is_active=true ORDER BY sl.name`,[id]),
    pool.query(`SELECT a.*,sl.name service_line,at.name asset_type,cl.label location_label FROM assets a JOIN service_lines sl ON sl.id=a.service_line_id LEFT JOIN asset_types at ON at.id=a.asset_type_id LEFT JOIN customer_locations cl ON cl.id=a.customer_location_id WHERE a.customer_id=$1 ORDER BY a.created_at DESC`,[id]),
    pool.query(`SELECT cn.*,u.display_name author FROM customer_notes cn LEFT JOIN users u ON u.id=cn.author_user_id WHERE cn.customer_id=$1 ORDER BY cn.created_at DESC`,[id]),
    pool.query(`SELECT wo.*,wos.code status_code,wos.name status,sl.name service_line,wot.name work_order_type,cl.label location_label,a.name asset,string_agg(u.display_name, ', ' ORDER BY u.display_name) assigned_to FROM work_orders wo JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id JOIN service_lines sl ON sl.id=wo.service_line_id JOIN customer_locations cl ON cl.id=wo.customer_location_id LEFT JOIN work_order_types wot ON wot.id=wo.work_order_type_id LEFT JOIN assets a ON a.id=wo.asset_id LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id LEFT JOIN users u ON u.id=woa.user_id WHERE wo.customer_id=$1 GROUP BY wo.id,wos.code,wos.name,sl.name,wot.name,cl.label,a.name ORDER BY wo.created_at DESC`,[id]),
    pool.query(`SELECT e.*,s.name status FROM estimates e JOIN estimate_statuses s ON s.id=e.estimate_status_id WHERE e.customer_id=$1 ORDER BY e.created_at DESC`,[id]),
    pool.query(`SELECT i.*,s.code status_code,s.name status FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE i.customer_id=$1 ORDER BY i.created_at DESC`,[id]),
    pool.query(`SELECT h.*,fs.name from_status,ts.name to_status,u.display_name changed_by FROM customer_status_history h LEFT JOIN customer_statuses fs ON fs.id=h.from_status_id JOIN customer_statuses ts ON ts.id=h.to_status_id LEFT JOIN users u ON u.id=h.changed_by_user_id WHERE h.customer_id=$1 ORDER BY h.created_at DESC`,[id]),
    pool.query(`SELECT ae.*,u.display_name actor FROM activity_events ae LEFT JOIN users u ON u.id=ae.actor_user_id WHERE ae.entity_type='customer' AND ae.entity_id=$1 ORDER BY ae.created_at DESC LIMIT 20`,[id])
  ]);
  return {...cr.rows[0],contacts:contacts.rows,locations:locations.rows,services:services.rows,assets:assets.rows,notes:notes.rows,workOrders:workOrders.rows,estimates:estimates.rows,invoices:invoices.rows,statusHistory:statusHistory.rows,activity:activity.rows};
}

async function getFormOptions(){
  const [statuses,sources,services,users,propertyTypes,workOrderTypes,workOrderStatuses,catalogItems]=await Promise.all([
    pool.query(`SELECT id,code,name FROM customer_statuses WHERE is_active=true ORDER BY sort_order`),
    pool.query(`SELECT id,code,name FROM lead_sources WHERE is_active=true ORDER BY name`),
    pool.query(`SELECT id,code,name FROM service_lines WHERE is_active=true ORDER BY name`),
    pool.query(`SELECT id,display_name FROM users WHERE is_active=true ORDER BY display_name`),
    pool.query(`SELECT id,name FROM property_types WHERE is_active=true ORDER BY name`),
    pool.query(`SELECT wot.id,wot.name,wot.service_line_id,sl.name service_line FROM work_order_types wot JOIN service_lines sl ON sl.id=wot.service_line_id WHERE wot.is_active=true ORDER BY sl.name,wot.name`),
    pool.query(`SELECT id,code,name FROM work_order_statuses WHERE is_active=true ORDER BY sort_order`),
    pool.query(`SELECT id,name,unit_price FROM catalog_items WHERE is_active=true ORDER BY name`)
  ]);
  return {statuses:statuses.rows,sources:sources.rows,services:services.rows,users:users.rows,propertyTypes:propertyTypes.rows,workOrderTypes:workOrderTypes.rows,workOrderStatuses:workOrderStatuses.rows,catalogItems:catalogItems.rows};
}

async function getStatusId(client, code){ const r=await client.query(`SELECT id FROM customer_statuses WHERE code=$1`,[code]); return r.rows[0]?.id; }
async function getWorkOrderStatusId(client, code){ const r=await client.query(`SELECT id FROM work_order_statuses WHERE code=$1`,[code]); return r.rows[0]?.id; }

async function createCustomer(data){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const c=await client.query(`INSERT INTO customers(display_name,customer_status_id,lead_source_id,assigned_user_id,company_name,notes_summary) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[data.display_name,data.customer_status_id,data.lead_source_id||null,data.assigned_user_id||null,data.company_name||null,data.notes_summary||null]);
    const id=c.rows[0].id;
    await client.query(`INSERT INTO customer_status_history(customer_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,'Initial customer creation')`,[id,data.customer_status_id,data.author_user_id||null]);
    await client.query(`INSERT INTO customer_contacts(customer_id,first_name,last_name,phone,email,preferred_contact_method,is_primary) VALUES($1,$2,$3,$4,$5,$6,true)`,[id,data.first_name||null,data.last_name||null,data.phone||null,data.email||null,data.preferred_contact_method||null]);
    await client.query(`INSERT INTO customer_locations(customer_id,property_type_id,label,address_line_1,city,state,postal_code,county,gate_code,access_notes,is_primary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`,[id,data.property_type_id||null,data.location_label||'Service Location',data.address_line_1||null,data.city||null,data.state||null,data.postal_code||null,data.county||null,data.gate_code||null,data.access_notes||null]);
    for(const serviceId of (data.service_line_ids||[])){ await client.query(`INSERT INTO customer_service_lines(customer_id,service_line_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[id,serviceId]); }
    if(data.initial_note){ await client.query(`INSERT INTO customer_notes(customer_id,author_user_id,note_body) VALUES($1,$2,$3)`,[id,data.author_user_id||null,data.initial_note]); }
    await client.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body) VALUES('customer',$1,$2,'customer.created','Customer record created')`,[id,data.author_user_id||null]);
    await client.query('COMMIT'); return id;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function updateCustomer(id,data){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const existing = await client.query(`SELECT customer_status_id FROM customers WHERE id=$1`,[id]);
    if(!existing.rows[0]) throw new Error('Customer not found');
    await client.query(`UPDATE customers SET display_name=$1,customer_status_id=$2,lead_source_id=$3,assigned_user_id=$4,company_name=$5,notes_summary=$6,updated_at=current_timestamp WHERE id=$7`,[data.display_name,data.customer_status_id,data.lead_source_id||null,data.assigned_user_id||null,data.company_name||null,data.notes_summary||null,id]);
    if(Number(existing.rows[0].customer_status_id)!==Number(data.customer_status_id)){
      await client.query(`INSERT INTO customer_status_history(customer_id,from_status_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,$4,$5)`,[id,existing.rows[0].customer_status_id,data.customer_status_id,data.author_user_id||null,'Manual customer edit']);
    }
    const contact=await client.query(`SELECT id FROM customer_contacts WHERE customer_id=$1 AND is_primary=true ORDER BY id LIMIT 1`,[id]);
    if(contact.rows[0]) await client.query(`UPDATE customer_contacts SET first_name=$1,last_name=$2,phone=$3,email=$4,preferred_contact_method=$5,updated_at=current_timestamp WHERE id=$6`,[data.first_name||null,data.last_name||null,data.phone||null,data.email||null,data.preferred_contact_method||null,contact.rows[0].id]);
    else await client.query(`INSERT INTO customer_contacts(customer_id,first_name,last_name,phone,email,preferred_contact_method,is_primary) VALUES($1,$2,$3,$4,$5,$6,true)`,[id,data.first_name||null,data.last_name||null,data.phone||null,data.email||null,data.preferred_contact_method||null]);
    const loc=await client.query(`SELECT id FROM customer_locations WHERE customer_id=$1 AND is_primary=true ORDER BY id LIMIT 1`,[id]);
    if(loc.rows[0]) await client.query(`UPDATE customer_locations SET property_type_id=$1,label=$2,address_line_1=$3,city=$4,state=$5,postal_code=$6,county=$7,gate_code=$8,access_notes=$9,updated_at=current_timestamp WHERE id=$10`,[data.property_type_id||null,data.location_label||'Service Location',data.address_line_1||null,data.city||null,data.state||null,data.postal_code||null,data.county||null,data.gate_code||null,data.access_notes||null,loc.rows[0].id]);
    else await client.query(`INSERT INTO customer_locations(customer_id,property_type_id,label,address_line_1,city,state,postal_code,county,gate_code,access_notes,is_primary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`,[id,data.property_type_id||null,data.location_label||'Service Location',data.address_line_1||null,data.city||null,data.state||null,data.postal_code||null,data.county||null,data.gate_code||null,data.access_notes||null]);
    await client.query(`DELETE FROM customer_service_lines WHERE customer_id=$1`,[id]);
    for(const serviceId of (data.service_line_ids||[])){ await client.query(`INSERT INTO customer_service_lines(customer_id,service_line_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[id,serviceId]); }
    await client.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body) VALUES('customer',$1,$2,'customer.updated','Customer record updated')`,[id,data.author_user_id||null]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function transitionCustomer(id, action, userId, reason){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const current=await client.query(`SELECT customer_status_id FROM customers WHERE id=$1`,[id]);
    if(!current.rows[0]) throw new Error('Customer not found');
    let toCode=null, eventType=null, eventBody=null;
    if(action==='contacted'){
      await client.query(`UPDATE customers SET assigned_user_id=COALESCE(assigned_user_id,$1),updated_at=current_timestamp WHERE id=$2`,[userId||null,id]);
      await client.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body) VALUES('customer',$1,$2,'lead.contacted',$3)`,[id,userId||null,reason||'Lead picked up / contact made']);
      await client.query('COMMIT');
      return;
    }
    if(action==='lost'){ toCode='lost'; eventType='lead.lost'; eventBody='Lead marked lost'; }
    if(action==='customer'){ toCode='customer'; eventType='customer.activated'; eventBody='Lead converted to customer'; }
    if(!toCode) throw new Error('Unknown transition');
    const toId=await getStatusId(client,toCode);
    await client.query(`UPDATE customers SET customer_status_id=$1,assigned_user_id=COALESCE(assigned_user_id,$2),updated_at=current_timestamp WHERE id=$3`,[toId,userId||null,id]);
    await client.query(`INSERT INTO customer_status_history(customer_id,from_status_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,$4,$5)`,[id,current.rows[0].customer_status_id,toId,userId||null,reason||eventBody]);
    await client.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body) VALUES('customer',$1,$2,$3,$4)`,[id,userId||null,eventType,eventBody]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function createWorkOrderFromCustomer(customerId,data,userId){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const customerStatus=await getStatusId(client,'customer');
    const requestedStatus=await getWorkOrderStatusId(client,'open');
    const customer=await client.query(`SELECT customer_status_id FROM customers WHERE id=$1`,[customerId]);
    const locationId=data.customer_location_id || (await client.query(`SELECT id FROM customer_locations WHERE customer_id=$1 ORDER BY is_primary DESC,id LIMIT 1`,[customerId])).rows[0]?.id;
    if(!locationId) throw new Error('Customer needs a service location before creating work order');
    const wo=await client.query(`INSERT INTO work_orders(customer_id,customer_location_id,asset_id,service_line_id,work_order_type_id,work_order_status_id,title,description,scheduled_start_at,quoted_price) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[customerId,locationId,data.asset_id||null,data.service_line_id,data.work_order_type_id||null,requestedStatus,data.title,data.description||null,data.scheduled_start_at||null,data.quoted_price||null]);
    const workOrderId=wo.rows[0].id;
    if(data.assigned_user_id){ await client.query(`INSERT INTO work_order_assignments(work_order_id,user_id,role_on_job) VALUES($1,$2,'technician')`,[workOrderId,data.assigned_user_id]); }
    await client.query(`INSERT INTO work_order_status_history(work_order_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,'Work order created from customer workflow')`,[workOrderId,requestedStatus,userId||null]);
    if(customerStatus && customer.rows[0] && Number(customer.rows[0].customer_status_id)!==Number(customerStatus)){
      await client.query(`UPDATE customers SET customer_status_id=$1,updated_at=current_timestamp WHERE id=$2`,[customerStatus,customerId]);
      await client.query(`INSERT INTO customer_status_history(customer_id,from_status_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,$4,'Customer requested service visit')`,[customerId,customer.rows[0].customer_status_id,customerStatus,userId||null]);
    }
    await client.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body) VALUES('customer',$1,$2,'work_order.created',$3)`,[customerId,userId||null,`Work order created: ${data.title}`]);
    await client.query('COMMIT'); return workOrderId;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}


async function deleteCustomer(id, userId){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const customer = await client.query(`SELECT display_name FROM customers WHERE id=$1`,[id]);
    if(!customer.rows[0]) throw new Error('Customer not found');

    const deps = await client.query(`
      SELECT
        (SELECT count(*)::int FROM work_orders WHERE customer_id=$1) AS work_order_count,
        (SELECT count(*)::int FROM estimates WHERE customer_id=$1) AS estimate_count,
        (SELECT count(*)::int FROM invoices WHERE customer_id=$1) AS invoice_count
    `,[id]);
    const d = deps.rows[0];
    if(d.work_order_count || d.estimate_count || d.invoice_count){
      throw new Error('Customer has work orders, estimates, or invoices. Mark inactive/lost instead of deleting operational history.');
    }

    await client.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body) VALUES('customer',$1,$2,'customer.deleted',$3)`,[id,userId||null,`Customer deleted: ${customer.rows[0].display_name}`]);
    await client.query(`DELETE FROM customers WHERE id=$1`,[id]);
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function addNote(customerId,userId,note){
  await pool.query(`INSERT INTO customer_notes(customer_id,author_user_id,note_body) VALUES($1,$2,$3)`,[customerId,userId||null,note]);
  await pool.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body) VALUES('customer',$1,$2,'note.added',$3)`,[customerId,userId||null,note]);
}
module.exports={listCustomers,getCustomerDetail,getFormOptions,createCustomer,updateCustomer,deleteCustomer,transitionCustomer,createWorkOrderFromCustomer,addNote};
