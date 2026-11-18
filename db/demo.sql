-- Original examples for interface preview, not a current or official question bank.
INSERT INTO questions(id,part,topic,title,prompt,bank,collection,is_demo,sort_order) VALUES
('30170000-0000-4000-8000-000000000001',1,'Work & study','你的学习与工作','Do you work or are you a student?','regular','体验题库 · 非真实考季',true,1),
('30170000-0000-4000-8000-000000000002',1,'Hometown','家乡的变化','What has changed in your hometown in recent years?','regular','体验题库 · 非真实考季',true,2),
('30170000-0000-4000-8000-000000000003',1,'Daily life','放松的方式','What do you usually do to relax after a busy day?','regular','体验题库 · 非真实考季',true,3),
('30170000-0000-4000-8000-000000000004',1,'Technology','一个常用的 App','Is there an app you find particularly useful?','new','体验题库 · 非真实考季',true,4),
('30170000-0000-4000-8000-000000000005',2,'Places','想再去一次的地方',E'Describe a place you would like to visit again.\n\nYou should say:\n• where it is\n• when you went there\n• what you did there\nand explain why you would like to go back.','regular','体验题库 · 非真实考季',true,5),
('30170000-0000-4000-8000-000000000006',2,'People','教会你一件事的人',E'Describe a person who taught you something useful.\n\nYou should say:\n• who this person is\n• what they taught you\n• how you learned it\nand explain why it was useful to you.','regular','体验题库 · 非真实考季',true,6),
('30170000-0000-4000-8000-000000000007',2,'Experiences','一次改变计划的经历',E'Describe a time when you changed your plans.\n\nYou should say:\n• what your original plan was\n• why you changed it\n• what you did instead\nand explain how you felt about the change.','new','体验题库 · 非真实考季',true,7),
('30170000-0000-4000-8000-000000000008',2,'Learning','想学会的一项技能',E'Describe a skill you would like to learn.\n\nYou should say:\n• what the skill is\n• why you want to learn it\n• how you would learn it\nand explain how it could help you.','new','体验题库 · 非真实考季',true,8),
('30170000-0000-4000-8000-000000000009',3,'Places','旅行与了解文化','How can travelling help people understand other cultures?','regular','体验题库 · 非真实考季',true,9),
('30170000-0000-4000-8000-000000000010',3,'Learning','成年人学习新技能','What challenges do adults face when learning a new skill?','regular','体验题库 · 非真实考季',true,10),
('30170000-0000-4000-8000-000000000011',3,'Technology','科技与面对面交流','How has technology changed the way people communicate face to face?','new','体验题库 · 非真实考季',true,11),
('30170000-0000-4000-8000-000000000012',3,'Daily life','工作与生活的平衡','What can employers do to help people maintain a healthy work-life balance?','new','体验题库 · 非真实考季',true,12)
ON CONFLICT(id) DO NOTHING;
