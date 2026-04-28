const pool = require('../../db/pool');

async function listCustomers(){
  const r = await pool.query(`SELECT c.id,c.display_name,cs.name status,string_agg(DISTINCT sl.name, ', ' ORDER BY sl.name) services, pc.phone, pc.email, pl.city, pl.state FROM customers c JOIN customer_statuses cs ON cs.id=c.customer_status_id LEFT JOIN customer_contacts pc ON pc.customer_id=c.id AND pc.is_primary=true LEFT JOIN customer_locations pl ON pl.customer_id=c.id AND pl.is_primary=true LEFT JOIN customer_service_lines csl ON csl.customer_id=c.id AND csl.is_active=true LEFT JOIN service_lines sl ON sl.id=csl.service_line_id GROUP BY c.id,c.display_name,cs.name,pc.phone,pc.email,pl.city,pl.state ORDER BY c.id DESC`);
  return r.rows;
}

async function getCustomerDetail(id){
  const cr=await pool.query(`SELECT c.*,cs.name status,ls.name lead_source,u.display_name assigned_to FROM customers c JOIN customer_statuses cs ON cs.id=c.customer_status_id LEFT JOIN lead_sources ls ON ls.id=c.lead_source_id LEFT JOIN users u ON u.id=c.assigned_user_id WHERE c.id=$1`,[id]);
  if(!cr.rows[0]) return null;
  const [contacts,locations,services,assets,notes,workOrders,estimates,invoices,statusHistory,activity]=await Promise.all([
    pool.query(`SELECT * FROM customer_contacts WHERE customer_id=$1 ORDER BY is_primary DESC,id`,[id]),
    pool.query(`SELECT cl.*,pt.name property_type FROM customer_locations cl LEFT JOIN property_types pt ON pt.id=cl.property_type_id WHERE cl.customer_id=$1 ORDER BY cl.is_primary DESC,cl.id`,[id]),
    pool.query(`SELECT sl.* FROM customer_service_lines csl JOIN service_lines sl ON sl.id=csl.service_line_id WHERE csl.customer_id=$1 ORDER BY sl.name`,[id]),
    pool.query(`SELECT a.*,sl.name service_line,at.name asset_type,cl.label location_label FROM assets a JOIN service_lines sl ON sl.id=a.service_line_id LEFT JOIN asset_types at ON at.id=a.asset_type_id LEFT JOIN customer_locations cl ON cl.id=a.customer_location_id WHERE a.customer_id=$1 ORDER BY a.created_at DESC`,[id]),
    pool.query(`SELECT cn.*,u.display_name author FROM customer_notes cn LEFT JOIN users u ON u.id=cn.author_user_id WHERE cn.customer_id=$1 ORDER BY cn.created_at DESC`,[id]),
    pool.query(`SELECT wo.*,wos.name status,sl.name service_line,wot.name work_order_type,cl.label location_label,a.name asset FROM work_orders wo JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id JOIN service_lines sl ON sl.id=wo.service_line_id JOIN customer_locations cl ON cl.id=wo.customer_location_id LEFT JOIN work_order_types wot ON wot.id=wo.work_order_type_id LEFT JOIN assets a ON a.id=wo.asset_id WHERE wo.customer_id=$1 ORDER BY wo.created_at DESC`,[id]),
    pool.query(`SELECT e.*,s.name status FROM estimates e JOIN estimate_statuses s ON s.id=e.estimate_status_id WHERE e.customer_id=$1 ORDER BY e.created_at DESC`,[id]),
    pool.query(`SELECT i.*,s.name status FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE i.customer_id=$1 ORDER BY i.created_at DESC`,[id]),
    pool.query(`SELECT h.*,fs.name from_status,ts.name to_status,u.display_name changed_by FROM customer_status_history h LEFT JOIN customer_statuses fs ON fs.id=h.from_status_id JOIN customer_statuses ts ON ts.id=h.to_status_id LEFT JOIN users u ON u.id=h.changed_by_user_id WHERE h.customer_id=$1 ORDER BY h.created_at DESC`,[id]),
    pool.query(`SELECT ae.*,u.display_name actor FROM activity_events ae LEFT JOIN users u ON u.id=ae.actor_user_id WHERE ae.entity_type='customer' AND ae.entity_id=$1 ORDER BY ae.created_at DESC LIMIT 20`,[id])
  ]);
  return {...cr.rows[0],contacts:contacts.rows,locations:locations.rows,services:services.rows,assets:assets.rows,notes:notes.rows,workOrders:workOrders.rows,estimates:estimates.rows,invoices:invoices.rows,statusHistory:statusHistory.rows,activity:activity.rows};
}

async function getFormOptions(){
  const [statuses,sources,services,users,propertyTypes]=await Promise.all([
    pool.query(`SELECT id,name FROM customer_statuses WHERE is_active=true ORDER BY sort_order`),
    pool.query(`SELECT id,name FROM lead_sources WHERE is_active=true ORDER BY name`),
    pool.query(`SELECT id,name FROM service_lines WHERE is_active=true ORDER BY name`),
    pool.query(`SELECT id,display_name FROM users WHERE is_active=true ORDER BY display_name`),
    pool.query(`SELECT id,name FROM property_types WHERE is_active=true ORDER BY name`)
  ]);
  return {statuses:statuses.rows,sources:sources.rows,services:services.rows,users:users.rows,propertyTypes:propertyTypes.rows};
}

async function createCustomer(data){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const c=await client.query(`INSERT INTO customers(display_name,customer_status_id,lead_source_id,assigned_user_id,company_name,notes_summary) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[data.display_name,data.customer_status_id,data.lead_source_id||null,data.assigned_user_id||null,data.company_name||null,data.notes_summary||null]);
    const id=c.rows[0].id;
    await client.query(`INSERT INTO customer_status_history(customer_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,'Initial customer creation')`,[id,data.customer_status_id,data.author_user_id||null]);
    await client.query(`INSERT INTO customer_contacts(customer_id,first_name,last_name,phone,email,preferred_contact_method,is_primary) VALUES($1,$2,$3,$4,$5,$6,true)`,[id,data.first_name||null,data.last_name||null,data.phone||null,data.email||null,data.preferred_contact_method||null]);
    await client.query(`INSERT INTO customer_locations(customer_id,property_type_id,label,address_line_1,city,state,postal_code,gate_code,access_notes,is_primary) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,true)`,[id,data.property_type_id||null,data.location_label||'Service Location',data.address_line_1||null,data.city||null,data.state||null,data.postal_code||null,data.gate_code||null,data.access_notes||null]);
    for(const serviceId of (data.service_line_ids||[])){
      await client.query(`INSERT INTO customer_service_lines(customer_id,service_line_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[id,serviceId]);
    }
    if(data.initial_note){
      await client.query(`INSERT INTO customer_notes(customer_id,author_user_id,note_body) VALUES($1,$2,$3)`,[id,data.author_user_id||null,data.initial_note]);
    }
    await client.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body) VALUES('customer',$1,$2,'customer.created','Customer record created')`,[id,data.author_user_id||null]);
    await client.query('COMMIT');
    return id;
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function addNote(customerId,userId,note){
  await pool.query(`INSERT INTO customer_notes(customer_id,author_user_id,note_body) VALUES($1,$2,$3)`,[customerId,userId||null,note]);
  await pool.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body) VALUES('customer',$1,$2,'note.added',$3)`,[customerId,userId||null,note]);
}
module.exports={listCustomers,getCustomerDetail,getFormOptions,createCustomer,addNote};
