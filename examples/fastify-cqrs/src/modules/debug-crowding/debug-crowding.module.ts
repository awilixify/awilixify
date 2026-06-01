import { createModule } from "awilixify";

const createDebugModule = (module: any): any => createModule<any>(module);

const IdentityModule = createDebugModule({
	name: "IdentityModule",
	providers: {
		identityStore: "identityStore",
		tokenSigner: "tokenSigner",
		userDirectory: "userDirectory",
	},
	exports: ["identityStore", "tokenSigner"],
});

const AuditTrailModule = createDebugModule({
	name: "AuditTrailModule",
	providers: {
		auditWriter: "auditWriter",
		auditReader: "auditReader",
		complianceLogger: "complianceLogger",
	},
	exports: ["auditWriter", "auditReader"],
});

const NotificationModule = createDebugModule({
	name: "NotificationModule",
	providers: {
		emailSender: "emailSender",
		smsSender: "smsSender",
		notificationTemplates: "notificationTemplates",
	},
	exports: ["emailSender", "notificationTemplates"],
});

const BillingCoreModule = createDebugModule({
	name: "BillingCoreModule",
	providers: {
		invoiceStore: "invoiceStore",
		taxCalculator: "taxCalculator",
		billingClock: "billingClock",
	},
	exports: ["invoiceStore", "taxCalculator"],
});

const ProductCatalogModule = createDebugModule({
	name: "ProductCatalogModule",
	providers: {
		productRepository: "productRepository",
		categoryTree: "categoryTree",
		catalogPublisher: "catalogPublisher",
	},
	exports: ["productRepository", "categoryTree"],
});

const InventoryModule = createDebugModule({
	name: "InventoryModule",
	providers: {
		stockLedger: "stockLedger",
		reservationStore: "reservationStore",
		reorderPlanner: "reorderPlanner",
	},
	exports: ["stockLedger", "reservationStore"],
});

const AccessPolicyModule = createDebugModule({
	name: "AccessPolicyModule",
	imports: [IdentityModule, AuditTrailModule],
	providers: {
		policyEngine: "policyEngine",
		permissionIndex: "permissionIndex",
	},
	exports: ["policyEngine"],
});

const FeatureFlagModule = createDebugModule({
	name: "FeatureFlagModule",
	imports: [IdentityModule, AuditTrailModule],
	providers: {
		flagStore: "flagStore",
		rolloutEvaluator: "rolloutEvaluator",
	},
	exports: ["flagStore", "rolloutEvaluator"],
});

const PricingModule = createDebugModule({
	name: "PricingModule",
	imports: [ProductCatalogModule, BillingCoreModule],
	providers: {
		priceBook: "priceBook",
		discountResolver: "discountResolver",
	},
	exports: ["priceBook"],
});

const PaymentModule = createDebugModule({
	name: "PaymentModule",
	imports: [BillingCoreModule, AuditTrailModule],
	providers: {
		paymentGateway: "paymentGateway",
		paymentLedger: "paymentLedger",
		fraudSignals: "fraudSignals",
	},
	exports: ["paymentGateway", "paymentLedger"],
});

const OrderModule = createDebugModule({
	name: "OrderModule",
	imports: [
		ProductCatalogModule,
		InventoryModule,
		PricingModule,
		PaymentModule,
		NotificationModule,
	],
	providers: {
		orderRepository: "orderRepository",
		checkoutCoordinator: "checkoutCoordinator",
		orderNumberGenerator: "orderNumberGenerator",
	},
	exports: ["orderRepository", "checkoutCoordinator"],
});

const ShippingModule = createDebugModule({
	name: "ShippingModule",
	imports: [OrderModule, InventoryModule, NotificationModule],
	providers: {
		carrierRegistry: "carrierRegistry",
		shipmentPlanner: "shipmentPlanner",
		trackingStore: "trackingStore",
	},
	exports: ["shipmentPlanner", "trackingStore"],
});

const WarehouseModule = createDebugModule({
	name: "WarehouseModule",
	imports: [InventoryModule, ShippingModule],
	providers: {
		pickingQueue: "pickingQueue",
		packingStationRegistry: "packingStationRegistry",
	},
	exports: ["pickingQueue"],
});

const CustomerSupportModule = createDebugModule({
	name: "CustomerSupportModule",
	imports: [OrderModule, IdentityModule, NotificationModule],
	providers: {
		ticketRepository: "ticketRepository",
		supportInbox: "supportInbox",
		customerTimeline: "customerTimeline",
	},
	exports: ["ticketRepository", "customerTimeline"],
});

const ReportingModule = createDebugModule({
	name: "ReportingModule",
	imports: [OrderModule, BillingCoreModule, ProductCatalogModule, AuditTrailModule],
	providers: {
		reportCatalog: "reportCatalog",
		metricSnapshots: "metricSnapshots",
	},
	exports: ["reportCatalog"],
});

const AnalyticsModule = createDebugModule({
	name: "AnalyticsModule",
	imports: [ReportingModule, FeatureFlagModule, ProductCatalogModule],
	providers: {
		eventWarehouse: "eventWarehouse",
		cohortBuilder: "cohortBuilder",
	},
	exports: ["eventWarehouse", "cohortBuilder"],
});

const SearchModule = createDebugModule({
	name: "SearchModule",
	imports: [ProductCatalogModule, InventoryModule],
	providers: {
		searchIndex: "searchIndex",
		searchRanker: "searchRanker",
	},
	exports: ["searchIndex"],
});

const RecommendationModule = createDebugModule({
	name: "RecommendationModule",
	imports: [ProductCatalogModule, AnalyticsModule, IdentityModule],
	providers: {
		recommendationModel: "recommendationModel",
		personalizationRules: "personalizationRules",
	},
	exports: ["recommendationModel"],
});

const MarketingModule = createDebugModule({
	name: "MarketingModule",
	imports: [NotificationModule, FeatureFlagModule, RecommendationModule],
	providers: {
		campaignPlanner: "campaignPlanner",
		audienceSegmentStore: "audienceSegmentStore",
	},
	exports: ["campaignPlanner"],
});

const ComplianceModule = createDebugModule({
	name: "ComplianceModule",
	imports: [AuditTrailModule, IdentityModule, BillingCoreModule],
	providers: {
		complianceRulebook: "complianceRulebook",
		evidenceArchive: "evidenceArchive",
	},
	exports: ["complianceRulebook"],
});

const DataRetentionModule = createDebugModule({
	name: "DataRetentionModule",
	imports: [ComplianceModule, AuditTrailModule],
	providers: {
		retentionPolicyStore: "retentionPolicyStore",
		deletionPlanner: "deletionPlanner",
	},
	exports: ["retentionPolicyStore"],
});

const SubscriptionModule = createDebugModule({
	name: "SubscriptionModule",
	imports: [BillingCoreModule, PaymentModule, NotificationModule],
	providers: {
		subscriptionStore: "subscriptionStore",
		renewalScheduler: "renewalScheduler",
		entitlementProjector: "entitlementProjector",
	},
	exports: ["subscriptionStore", "entitlementProjector"],
});

const LoyaltyModule = createDebugModule({
	name: "LoyaltyModule",
	imports: [OrderModule, MarketingModule, IdentityModule],
	providers: {
		pointsLedger: "pointsLedger",
		rewardCatalog: "rewardCatalog",
	},
	exports: ["pointsLedger"],
});

export const DebugCrowdingModule = createDebugModule({
	name: "DebugCrowdingModule",
	imports: [
		AccessPolicyModule,
		AnalyticsModule,
		CustomerSupportModule,
		DataRetentionModule,
		LoyaltyModule,
		MarketingModule,
		ReportingModule,
		SearchModule,
		ShippingModule,
		SubscriptionModule,
		WarehouseModule,
	],
	providers: {
		debugGraphSeed: "debugGraphSeed",
		debugScenarioName: "crowded-module-graph",
	},
	exports: ["debugGraphSeed"],
});
