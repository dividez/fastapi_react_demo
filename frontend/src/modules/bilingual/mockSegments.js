export const BILINGUAL_MOCK_SEGMENTS = [
  {
    id: "seg-1",
    sourceHtml: "<h1>战略合作协议</h1>",
    translationHtml: "<h1>Strategic Cooperation Agreement</h1>",
  },
  {
    id: "seg-2",
    sourceHtml:
      "<h2>第一条 释义</h2><p><strong>1.1 合同主体。</strong> 上海云杉科技有限公司（以下简称“甲方”）与北京远航供应链管理有限公司（以下简称“乙方”）。</p><p><strong>1.2 参考文件。</strong> 本协议附件包括但不限于《保密义务函》《服务级别协议》，均为本协议不可分割之组成部分。</p>",
    translationHtml:
      "<h2>Article 1 Definitions</h2><p><strong>1.1 Contracting Parties.</strong> Shanghai Yunsan Technology Co., Ltd. (\"Party A\") and Beijing Yuanhang Supply Chain Management Co., Ltd. (\"Party B\").</p><p><strong>1.2 Reference Documents.</strong> Annexes hereto, including but not limited to the <strong>Confidentiality Undertaking</strong> and the <strong>Service Level Agreement</strong>, form an integral part of this Agreement.</p>",
  },
  {
    id: "seg-3",
    sourceHtml:
      "<h3>第二条 合作范围</h3><p>2.1 甲方授权乙方在华东区域作为 <em>独家渠道合作伙伴</em> ，负责推广甲方的企业采购 SaaS 平台。</p><p>2.2 乙方应于本协议生效后 <strong>30 日内</strong> 完成首批 5 家旗舰客户的上线部署。</p><p>2.3 本协议合作期内，双方协同推进如下目标：</p><ol><li>建立联合客户成功团队，确保月度满意度评分不低于 4.6 分；</li><li>每季度至少发起一次联合市场活动，包括但不限于在线研讨会、白皮书共创；</li><li>针对重点行业客户制定定制化集成方案，并提供不少于两次的实施培训。</li></ol>",
    translationHtml:
      "<h3>Article 2 Scope of Cooperation</h3><p>2.1 Party A appoints Party B as the <em>exclusive channel partner</em> in East China to promote Party A’s enterprise procurement SaaS platform.</p><p>2.2 Party B shall complete onboarding and deployment for five (5) flagship clients within <strong>30 calendar days</strong> from the Effective Date.</p><p>2.3 During the cooperation term, the Parties shall jointly pursue the following objectives:</p><ol><li>Establish a joint customer success squad to maintain a monthly satisfaction score of no less than 4.6.</li><li>Launch at least one co-branded marketing event each quarter, including but not limited to webinars and co-authored whitepapers.</li><li>Design tailored integration blueprints for key industries and deliver no fewer than two implementation workshops.</li></ol>",
  },
  {
    id: "seg-4",
    sourceHtml:
      "<h3>第三条 费用与支付</h3><p>3.1 乙方应按照下表所列费率向甲方支付平台服务费：</p><table><thead><tr><th>收费项目</th><th>计费方式</th><th>标准单价（人民币）</th><th>备注</th></tr></thead><tbody><tr><td>平台接入费</td><td>一次性</td><td>￥80,000</td><td>含 API 初始化配置</td></tr><tr><td>年度订阅费</td><td>按客户数</td><td>￥18,000 / 客户</td><td>含 7×24 小时支持</td></tr><tr><td>增值功能包</td><td>按模块</td><td>￥6,800 / 模块</td><td>包括 AI 合同审校</td></tr></tbody></table><p>3.2 乙方应于每个自然季度结束后 <strong>10 个工作日</strong> 内完成费用结算。</p>",
    translationHtml:
      "<h3>Article 3 Fees and Payment</h3><p>3.1 Party B shall pay the platform service fees pursuant to the schedule below:</p><table><thead><tr><th>Fee Item</th><th>Billing Method</th><th>Standard Price (CNY)</th><th>Notes</th></tr></thead><tbody><tr><td>Platform Access Fee</td><td>One-off</td><td>¥80,000</td><td>Includes API initialization</td></tr><tr><td>Annual Subscription</td><td>Per client</td><td>¥18,000 / client</td><td>24/7 support included</td></tr><tr><td>Value-added Package</td><td>Per module</td><td>¥6,800 / module</td><td>Includes AI contract review</td></tr></tbody></table><p>3.2 Party B shall settle the fees within <strong>ten (10) business days</strong> after each calendar quarter.</p>",
  },
  {
    id: "seg-5",
    sourceHtml:
      "<h3>第四条 知识产权</h3><p>4.1 合作期间任何一方提供的商标、专利、技术文档等均归原权利人所有。</p><p>4.2 非经权利人书面许可，另一方不得以任何形式复制、传播、展示、修改或逆向工程相关成果。</p><p>4.3 如因使用相关成果导致第三方索赔，由责任方独立承担全部费用。</p>",
    translationHtml:
      "<h3>Article 4 Intellectual Property</h3><p>4.1 All trademarks, patents, technical documents and other materials provided by either Party remain the property of the original rights holder.</p><p>4.2 Without prior written consent of the rights holder, the other Party shall not copy, disseminate, display, modify, or reverse engineer any such deliverables.</p><p>4.3 The liable Party shall bear all costs in connection with any third-party claim arising from the use of the deliverables.</p>",
  },
  {
    id: "seg-6",
    sourceHtml:
      "<h3>第五条 服务级别</h3><p>5.1 甲方应保证关键接口可用性不低于 <strong>99.5%</strong>。</p><p>5.2 乙方如发现重大故障，可通过专线 400-800-9000 或企业微信 @值班经理 进行升级。</p><p>5.3 服务响应等级如下：</p><table><thead><tr><th>严重等级</th><th>示例场景</th><th>响应时间</th><th>解决时限</th></tr></thead><tbody><tr><td>Level 1</td><td>系统全量不可用</td><td>15 分钟内</td><td>4 小时</td></tr><tr><td>Level 2</td><td>核心功能受限</td><td>30 分钟内</td><td>8 小时</td></tr><tr><td>Level 3</td><td>个别用户异常</td><td>2 小时内</td><td>24 小时</td></tr></tbody></table>",
    translationHtml:
      "<h3>Article 5 Service Levels</h3><p>5.1 Party A shall maintain availability of key APIs at no less than <strong>99.5%</strong>.</p><p>5.2 In the event of a critical incident, Party B may escalate via the dedicated hotline 400-800-9000 or ping the on-duty manager on WeCom.</p><p>5.3 Service response tiers are as follows:</p><table><thead><tr><th>Severity</th><th>Sample Scenario</th><th>Response Time</th><th>Resolution SLA</th></tr></thead><tbody><tr><td>Level 1</td><td>Platform-wide outage</td><td>Within 15 minutes</td><td>4 hours</td></tr><tr><td>Level 2</td><td>Core features impaired</td><td>Within 30 minutes</td><td>8 hours</td></tr><tr><td>Level 3</td><td>Isolated user issue</td><td>Within 2 hours</td><td>24 hours</td></tr></tbody></table>",
  },
  {
    id: "seg-7",
    sourceHtml:
      "<h3>第六条 保密义务</h3><p>6.1 双方承诺对在合作过程中获知的商业秘密予以严格保密。</p><p>6.2 保密义务在本协议终止后仍持续 <strong>五（5）年</strong>。</p><blockquote><p>任何一方违反本条约定的，应向守约方支付违约金人民币 300,000 元，并赔偿由此造成的全部损失。</p></blockquote>",
    translationHtml:
      "<h3>Article 6 Confidentiality</h3><p>6.1 Each Party undertakes to keep in strict confidence any trade secrets obtained in the course of cooperation.</p><p>6.2 The confidentiality obligations shall survive for <strong>five (5) years</strong> following the termination of this Agreement.</p><blockquote><p>The breaching Party shall pay the non-breaching Party liquidated damages of RMB 300,000 and indemnify all losses incurred.</p></blockquote>",
  },
  {
    id: "seg-8",
    sourceHtml:
      "<h3>第七条 期限与终止</h3><p>7.1 本协议自 <strong>2024 年 5 月 1 日</strong> 起生效，有效期为两（2）年。</p><p>7.2 任一方提前 60 日书面通知，可提出不再续签。</p><p>7.3 如一方严重违约，守约方有权立即解除本协议。</p>",
    translationHtml:
      "<h3>Article 7 Term and Termination</h3><p>7.1 This Agreement becomes effective on <strong>1 May 2024</strong> and shall remain in force for a term of two (2) years.</p><p>7.2 Either Party may elect not to renew by giving sixty (60) days’ prior written notice.</p><p>7.3 In case of material breach by one Party, the other Party may terminate this Agreement forthwith.</p>",
  },
  {
    id: "seg-9",
    sourceHtml:
      "<h3>第八条 争议解决</h3><p>8.1 双方应首先通过友好协商解决争议；协商不成的，提交中国国际经济贸易仲裁委员会上海分会仲裁。</p><p>8.2 仲裁裁决是终局的，对双方均具有约束力。</p>",
    translationHtml:
      "<h3>Article 8 Dispute Resolution</h3><p>8.1 The Parties shall first attempt to resolve any dispute through amicable negotiation. Failing such negotiation, the dispute shall be submitted to CIETAC Shanghai for arbitration.</p><p>8.2 The arbitral award shall be final and binding upon both Parties.</p>",
  },
  {
    id: "seg-10",
    sourceHtml:
      "<h3>第九条 附件与签署</h3><p>附件：<ul><li>附件一：上线实施计划（含时间节点）</li><li>附件二：联合市场推广方案</li></ul></p><p>本协议一式两份，双方各执一份，自双方授权代表签字并加盖公章之日起生效。</p><p><strong>甲方：</strong> 上海云杉科技有限公司</p><p><strong>乙方：</strong> 北京远航供应链管理有限公司</p><p>（以下为签署页，无正文）</p>",
    translationHtml:
      "<h3>Article 9 Annexes and Execution</h3><p>Annexes:<ul><li>Annex I: Implementation Roadmap (with milestones)</li><li>Annex II: Joint Marketing Program</li></ul></p><p>This Agreement is executed in two counterparts, each Party holding one original, and shall take effect upon signature and affixation of the official seals by the authorized representatives.</p><p><strong>Party A:</strong> Shanghai Yunsan Technology Co., Ltd.</p><p><strong>Party B:</strong> Beijing Yuanhang Supply Chain Management Co., Ltd.</p><p>(Signature page to follow)</p>",
  },
];
