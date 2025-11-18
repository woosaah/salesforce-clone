import { query } from '../config/database';

async function seedMarketing() {
  try {
    console.log('🌱 Seeding Marketing Cloud data...');

    // Get demo tenant
    const tenantResult = await query('SELECT tenant_id FROM tenants LIMIT 1');
    if (tenantResult.length === 0) {
      console.error('❌ No tenant found. Please run base migrations and seeds first.');
      return;
    }
    const tenantId = tenantResult[0].tenant_id;

    // Get demo user
    const userResult = await query(
      'SELECT user_id FROM users WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );
    if (userResult.length === 0) {
      console.error('❌ No user found for tenant.');
      return;
    }
    const userId = userResult[0].user_id;

    // Set tenant context
    await query(`SET app.current_tenant_id = '${tenantId}'`);

    // Create campaigns
    console.log('  📧 Creating campaigns...');
    const campaigns = await query(
      `INSERT INTO campaigns (
        tenant_id, campaign_name, campaign_type, status, start_date, end_date,
        budgeted_cost, actual_cost, expected_revenue, actual_revenue,
        description, owner_id, created_by, modified_by
      ) VALUES
        ($1, 'Spring Sale 2025', 'Email', 'In Progress', '2025-03-01', '2025-03-31', 5000, 4200, 50000, 35000, 'Spring season promotional campaign', $2, $2, $2),
        ($1, 'Product Launch Webinar', 'Webinar', 'Planned', '2025-04-15', '2025-04-15', 2000, 0, 20000, 0, 'New product line introduction webinar', $2, $2, $2),
        ($1, 'Customer Appreciation Event', 'Event', 'Completed', '2025-01-10', '2025-01-10', 10000, 9500, 75000, 82000, 'Annual customer appreciation event', $2, $2, $2),
        ($1, 'Holiday Gift Guide', 'Direct Mail', 'Completed', '2024-11-01', '2024-12-31', 8000, 7800, 100000, 125000, 'Holiday season direct mail campaign', $2, $2, $2),
        ($1, 'Summer Newsletter Series', 'Email', 'Planned', '2025-06-01', '2025-08-31', 3000, 0, 30000, 0, 'Monthly newsletter series for summer', $2, $2, $2)
      RETURNING campaign_id, campaign_name`,
      [tenantId, userId]
    );

    console.log(`  ✅ Created ${campaigns.length} campaigns`);

    // Get leads and contacts for campaign members
    const leads = await query(
      'SELECT object_id, data FROM object_data WHERE tenant_id = $1 AND object_type = $2 LIMIT 20',
      [tenantId, 'Lead']
    );

    const contacts = await query(
      'SELECT object_id, data FROM object_data WHERE tenant_id = $1 AND object_type = $2 LIMIT 20',
      [tenantId, 'Contact']
    );

    console.log('  👥 Creating campaign members...');
    const memberStatuses = ['Sent', 'Responded', 'Converted', 'Bounced'];
    let memberCount = 0;

    // Add members to each campaign
    for (const campaign of campaigns) {
      // Add leads
      for (let i = 0; i < Math.min(leads.length, 10); i++) {
        const lead = leads[i];
        const status = memberStatuses[Math.floor(Math.random() * memberStatuses.length)];
        const hasResponded = status === 'Responded' || status === 'Converted';
        const firstRespondedDate = hasResponded ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null;

        await query(
          `INSERT INTO campaign_members (
            tenant_id, campaign_id, lead_id, status, has_responded, first_responded_date, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            tenantId,
            campaign.campaign_id,
            lead.object_id,
            status,
            hasResponded,
            firstRespondedDate,
            `Campaign member from ${campaign.campaign_name}`
          ]
        );
        memberCount++;
      }

      // Add contacts
      for (let i = 0; i < Math.min(contacts.length, 10); i++) {
        const contact = contacts[i];
        const status = memberStatuses[Math.floor(Math.random() * memberStatuses.length)];
        const hasResponded = status === 'Responded' || status === 'Converted';
        const firstRespondedDate = hasResponded ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null;

        await query(
          `INSERT INTO campaign_members (
            tenant_id, campaign_id, contact_id, status, has_responded, first_responded_date, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            tenantId,
            campaign.campaign_id,
            contact.object_id,
            status,
            hasResponded,
            firstRespondedDate,
            `Campaign member from ${campaign.campaign_name}`
          ]
        );
        memberCount++;
      }
    }

    console.log(`  ✅ Created ${memberCount} campaign members`);

    // Get email templates
    const templates = await query(
      'SELECT template_id, template_name FROM email_templates WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );

    if (templates.length === 0) {
      console.log('  ⚠️  No email templates found. Skipping email campaigns.');
      return;
    }

    // Create email campaigns
    console.log('  ✉️  Creating email campaigns...');
    const emailCampaignStatuses = ['Draft', 'Scheduled', 'Sent'];

    const springSaleCampaign = campaigns.find((c: any) => c.campaign_name === 'Spring Sale 2025');
    const holidayCampaign = campaigns.find((c: any) => c.campaign_name === 'Holiday Gift Guide');

    const emailCampaigns = [];

    if (springSaleCampaign) {
      const ec1 = await query(
        `INSERT INTO email_campaigns (
          tenant_id, campaign_id, template_id, subject, from_name, from_email,
          reply_to_email, scheduled_date, recipients, status,
          total_sent, total_delivered, total_bounced,
          created_by, modified_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
        RETURNING email_campaign_id`,
        [
          tenantId,
          springSaleCampaign.campaign_id,
          templates[0].template_id,
          '🌸 Spring Sale - 30% Off Everything!',
          'Sales Team',
          'sales@example.com',
          'support@example.com',
          new Date('2025-03-01'),
          JSON.stringify({ allCampaignMembers: true }),
          'Sent',
          20, 19, 1,
          userId
        ]
      );
      emailCampaigns.push(ec1[0]);
    }

    if (holidayCampaign) {
      const ec2 = await query(
        `INSERT INTO email_campaigns (
          tenant_id, campaign_id, template_id, subject, from_name, from_email,
          reply_to_email, scheduled_date, recipients, status,
          total_sent, total_delivered, total_bounced, sent_date,
          created_by, modified_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
        RETURNING email_campaign_id`,
        [
          tenantId,
          holidayCampaign.campaign_id,
          templates[0].template_id,
          '🎁 Holiday Gift Guide 2024',
          'Marketing Team',
          'marketing@example.com',
          'support@example.com',
          new Date('2024-11-15'),
          JSON.stringify({ allCampaignMembers: true }),
          'Sent',
          20, 18, 2,
          new Date('2024-11-15'),
          userId
        ]
      );
      emailCampaigns.push(ec2[0]);
    }

    console.log(`  ✅ Created ${emailCampaigns.length} email campaigns`);

    // Create email analytics
    console.log('  📊 Creating email analytics...');
    let analyticsCount = 0;

    for (const emailCampaign of emailCampaigns) {
      // Get campaign members for this email campaign
      const campaignMembers = await query(
        `SELECT cm.*,
          CASE
            WHEN cm.lead_id IS NOT NULL THEN (SELECT data->>'email' FROM object_data WHERE object_id = cm.lead_id)
            WHEN cm.contact_id IS NOT NULL THEN (SELECT data->>'email' FROM object_data WHERE object_id = cm.contact_id)
          END as email,
          CASE
            WHEN cm.lead_id IS NOT NULL THEN 'Lead'
            WHEN cm.contact_id IS NOT NULL THEN 'Contact'
          END as recipient_type,
          COALESCE(cm.lead_id, cm.contact_id) as recipient_id
         FROM campaign_members cm
         JOIN email_campaigns ec ON cm.campaign_id = ec.campaign_id
         WHERE ec.email_campaign_id = $1
         LIMIT 20`,
        [emailCampaign.email_campaign_id]
      );

      for (const member of campaignMembers) {
        if (!member.email) continue;

        const sent = true;
        const delivered = Math.random() > 0.05; // 95% delivery rate
        const opened = delivered && Math.random() > 0.4; // 60% open rate
        const clicked = opened && Math.random() > 0.7; // 30% click rate
        const bounced = !delivered;

        const sentDate = new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000);
        const deliveredDate = delivered ? new Date(sentDate.getTime() + Math.random() * 60 * 60 * 1000) : null;
        const openedDate = opened ? new Date(deliveredDate!.getTime() + Math.random() * 24 * 60 * 60 * 1000) : null;
        const clickedDate = clicked ? new Date(openedDate!.getTime() + Math.random() * 60 * 60 * 1000) : null;

        await query(
          `INSERT INTO email_analytics (
            tenant_id, email_campaign_id, recipient_email, recipient_type, recipient_id,
            sent, sent_date, delivered, delivered_date, opened, opened_date, open_count,
            clicked, clicked_date, click_count, bounced, bounce_reason
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
          [
            tenantId,
            emailCampaign.email_campaign_id,
            member.email,
            member.recipient_type,
            member.recipient_id,
            sent,
            sentDate,
            delivered,
            deliveredDate,
            opened,
            openedDate,
            opened ? Math.floor(Math.random() * 3) + 1 : 0,
            clicked,
            clickedDate,
            clicked ? Math.floor(Math.random() * 2) + 1 : 0,
            bounced,
            bounced ? 'Mailbox full' : null
          ]
        );
        analyticsCount++;
      }
    }

    console.log(`  ✅ Created ${analyticsCount} email analytics records`);

    // Create tracking links
    console.log('  🔗 Creating tracking links...');
    let linkCount = 0;

    for (const emailCampaign of emailCampaigns) {
      const links = [
        { url: 'https://example.com/products', token: `TRK-${Date.now()}-${Math.random().toString(36).substring(7)}` },
        { url: 'https://example.com/special-offer', token: `TRK-${Date.now()}-${Math.random().toString(36).substring(7)}` },
        { url: 'https://example.com/learn-more', token: `TRK-${Date.now()}-${Math.random().toString(36).substring(7)}` }
      ];

      for (const link of links) {
        await query(
          `INSERT INTO email_tracking_links (
            email_campaign_id, original_url, tracking_token, click_count
          ) VALUES ($1, $2, $3, $4)`,
          [
            emailCampaign.email_campaign_id,
            link.url,
            link.token,
            Math.floor(Math.random() * 50)
          ]
        );
        linkCount++;
      }
    }

    console.log(`  ✅ Created ${linkCount} tracking links`);

    // Create unsubscribe list
    console.log('  🚫 Creating unsubscribe list...');
    const unsubscribeEmails = [
      { email: 'unsubscribe1@example.com', reason: 'Too many emails' },
      { email: 'unsubscribe2@example.com', reason: 'Not interested anymore' },
      { email: 'unsubscribe3@example.com', reason: 'Never signed up' }
    ];

    for (const unsub of unsubscribeEmails) {
      await query(
        `INSERT INTO unsubscribe_list (tenant_id, email, reason)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, email) DO NOTHING`,
        [tenantId, unsub.email, unsub.reason]
      );
    }

    console.log(`  ✅ Created ${unsubscribeEmails.length} unsubscribe records`);

    console.log('✅ Marketing Cloud seed data completed!');
  } catch (error) {
    console.error('❌ Error seeding Marketing Cloud data:', error);
    throw error;
  }
}

// Run seeder
if (require.main === module) {
  seedMarketing()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default seedMarketing;
