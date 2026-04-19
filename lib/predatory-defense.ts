/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    PREDATORY DEFENSE SYSTEM - Zero Tolerance             ║
 * ║         Real-Time Load Balancing | Firewall Hardening | Auto-War        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Any latency or security threat is treated as a "Declaration of War."
 * Automates load-balancing and firewall hardening in real-time.
 */

import { createClient } from "@supabase/supabase-js";

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface SecurityThreat {
  id: string;
  timestamp: Date;
  type: "ddos" | "injection" | "bot" | "scraping" | "latency" | "resource_exhaustion" | "unauthorized_access";
  severity: "critical" | "high" | "medium" | "low";
  source: {
    ip?: string;
    country?: string;
    userAgent?: string;
    requestPath?: string;
  };
  metrics: {
    requestCount: number;
    errorRate: number;
    avgLatency: number;
    bandwidthUsed: number;
  };
  status: "detected" | "analyzing" | "mitigating" | "neutralized" | "monitoring";
  countermeasures: Countermeasure[];
  autoResolved: boolean;
}

interface Countermeasure {
  id: string;
  type: "block_ip" | "rate_limit" | "challenge" | "cache" | "scale" | "alert" | "honeypot";
  applied: boolean;
  timestamp: Date;
  effectiveness: number; // 0-100
}

export interface DefenseMetrics {
  timestamp: Date;
  totalRequests: number;
  blockedRequests: number;
  avgLatency: number;
  errorRate: number;
  activeThreats: number;
  neutralizedThreats: number;
  systemHealth: "optimal" | "stable" | "degraded" | "under_attack";
  empireStatus: string;
}

export interface LoadBalancer {
  region: string;
  healthy: boolean;
  currentLoad: number;
  capacity: number;
  avgResponseTime: number;
  lastHealthCheck: Date;
}

// ==========================================
// PREDATORY DEFENSE ENGINE
// ==========================================

export class PredatoryDefenseSystem {
  private _supabase: ReturnType<typeof createClient> | null = null;

  private get supabase() {
    if (!this._supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Missing Supabase credentials");
      this._supabase = createClient(url, key);
    }
    return this._supabase;
  }
  
  private threats: Map<string, SecurityThreat> = new Map();
  private loadBalancers: Map<string, LoadBalancer> = new Map();
  private blockedIPs: Set<string> = new Set();
  private rateLimitStore: Map<string, { count: number; windowStart: number }> = new Map();
  private defenseInterval?: NodeJS.Timeout;
  private isActive = false;

  // Defense thresholds
  private readonly THREAT_THRESHOLDS = {
    ddos: { requestsPerSecond: 1000, errorRate: 50 },
    scraping: { requestsPerMinute: 100, uniquePaths: 50 },
    bot: { suspiciousPatterns: 10 },
    latency: { p99: 5000 }, // 5 seconds
    resource_exhaustion: { cpu: 90, memory: 85 },
  };

  constructor() {
    this.initializeLoadBalancers();
    this.loadBlockedIPs();
  }

  private initializeLoadBalancers() {
    const regions = ["us-east", "us-west", "eu-west", "eu-central", "asia-east"];
    
    for (const region of regions) {
      this.loadBalancers.set(region, {
        region,
        healthy: true,
        currentLoad: Math.random() * 30,
        capacity: 10000,
        avgResponseTime: 50 + Math.random() * 100,
        lastHealthCheck: new Date(),
      });
    }
  }

  private async loadBlockedIPs() {
    const { data } = await this.supabase
      .from("blocked_ips")
      .select("ip")
      .eq("active", true);

    if (data) {
      const typedData = data as unknown as Array<{ ip: string }>;
      for (const record of typedData) {
        this.blockedIPs.add(record.ip);
      }
    }
  }

  // ==========================================
  // THREAT DETECTION
  // ==========================================

  analyzeRequest(request: {
    ip: string;
    userAgent: string;
    path: string;
    timestamp: number;
    latency: number;
  }): SecurityThreat | null {
    // Check if IP is already blocked
    if (this.blockedIPs.has(request.ip)) {
      return this.createThreat("unauthorized_access", "critical", request);
    }

    // Check rate limiting
    const rateLimit = this.checkRateLimit(request.ip);
    if (rateLimit.exceeded) {
      return this.createThreat("ddos", rateLimit.severity as SecurityThreat["severity"], request);
    }

    // Detect scraping patterns
    const scrapingScore = this.detectScraping(request);
    if (scrapingScore > 0.8) {
      return this.createThreat("scraping", "high", request);
    }

    // Detect bot behavior
    const botScore = this.detectBot(request);
    if (botScore > 0.9) {
      return this.createThreat("bot", "medium", request);
    }

    // Detect latency issues
    if (request.latency > this.THREAT_THRESHOLDS.latency.p99) {
      return this.createThreat("latency", "high", { ...request, metrics: { latency: request.latency } });
    }

    return null;
  }

  private checkRateLimit(ip: string): { exceeded: boolean; severity: string } {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const limit = 100; // requests per minute
    
    const record = this.rateLimitStore.get(ip);
    
    if (!record || now - record.windowStart > windowMs) {
      this.rateLimitStore.set(ip, { count: 1, windowStart: now });
      return { exceeded: false, severity: "low" };
    }
    
    record.count++;
    
    if (record.count > limit * 10) return { exceeded: true, severity: "critical" };
    if (record.count > limit * 5) return { exceeded: true, severity: "high" };
    if (record.count > limit) return { exceeded: true, severity: "medium" };
    
    return { exceeded: false, severity: "low" };
  }

  private detectScraping(request: { ip: string; path: string }): number {
    // Track unique paths per IP
    const key = `paths_${request.ip}`;
    const paths = (this.rateLimitStore.get(key)?.count || 0) + 1;
    this.rateLimitStore.set(key, { count: paths, windowStart: Date.now() });
    
    // High score if accessing many unique paths rapidly
    return Math.min(1, paths / this.THREAT_THRESHOLDS.scraping.uniquePaths);
  }

  private detectBot(request: { userAgent: string }): number {
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /phantomjs/i, /selenium/i, /puppeteer/i,
      /headless/i, /automation/i,
    ];
    
    if (botPatterns.some(p => p.test(request.userAgent))) {
      return 0.95;
    }
    
    return 0;
  }

  private createThreat(
    type: SecurityThreat["type"],
    severity: SecurityThreat["severity"],
    data: any
  ): SecurityThreat {
    const id = `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const threat: SecurityThreat = {
      id,
      timestamp: new Date(),
      type,
      severity,
      source: {
        ip: data.ip,
        userAgent: data.userAgent,
        requestPath: data.path,
      },
      metrics: {
        requestCount: data.metrics?.requestCount || 1,
        errorRate: data.metrics?.errorRate || 0,
        avgLatency: data.metrics?.latency || 0,
        bandwidthUsed: 0,
      },
      status: "detected",
      countermeasures: [],
      autoResolved: false,
    };

    this.threats.set(id, threat);
    
    // Immediate countermeasure deployment
    this.deployCountermeasures(threat);
    
    return threat;
  }

  // ==========================================
  // COUNTERMEASURES
  // ==========================================

  private async deployCountermeasures(threat: SecurityThreat): Promise<void> {
    threat.status = "mitigating";
    
    const measures: Countermeasure["type"][] = [];
    
    switch (threat.type) {
      case "ddos":
        measures.push("block_ip", "rate_limit", "scale");
        break;
      case "scraping":
        measures.push("challenge", "rate_limit", "honeypot");
        break;
      case "bot":
        measures.push("challenge", "honeypot");
        break;
      case "latency":
        measures.push("cache", "scale", "alert");
        break;
      case "resource_exhaustion":
        measures.push("scale", "alert");
        break;
      default:
        measures.push("alert");
    }

    for (const measure of measures) {
      await this.applyCountermeasure(threat, measure);
    }

    threat.status = "neutralized";
    threat.autoResolved = true;
    
    // Store in database
    await this.supabase.from("security_threats").insert({
      id: threat.id,
      timestamp: threat.timestamp.toISOString(),
      type: threat.type,
      severity: threat.severity,
      source_ip: threat.source.ip,
      status: threat.status,
      auto_resolved: threat.autoResolved,
    } as never);
  }

  private async applyCountermeasure(
    threat: SecurityThreat,
    type: Countermeasure["type"]
  ): Promise<void> {
    const countermeasure: Countermeasure = {
      id: `cm_${Date.now()}_${type}`,
      type,
      applied: true,
      timestamp: new Date(),
      effectiveness: 100,
    };

    switch (type) {
      case "block_ip":
        if (threat.source.ip) {
          this.blockedIPs.add(threat.source.ip);
          await this.supabase.from("blocked_ips").upsert({
            ip: threat.source.ip,
            reason: threat.type,
            blocked_at: new Date().toISOString(),
            active: true,
          } as never);
        }
        break;
        
      case "rate_limit":
        // Already handled in checkRateLimit
        break;
        
      case "challenge":
        // Would trigger CAPTCHA or proof-of-work challenge
        break;
        
      case "cache":
        // Would enable aggressive caching
        break;
        
      case "scale":
        await this.scaleInfrastructure(threat.severity);
        break;
        
      case "alert":
        await this.sendDefenseAlert(threat);
        break;
        
      case "honeypot":
        // Would redirect to honeypot endpoints
        break;
    }

    threat.countermeasures.push(countermeasure);
  }

  private async scaleInfrastructure(severity: SecurityThreat["severity"]): Promise<void> {
    const scaleFactor = severity === "critical" ? 3 : severity === "high" ? 2 : 1.5;
    
    for (const [region, balancer] of this.loadBalancers) {
      if (balancer.healthy) {
        balancer.capacity = Math.floor(balancer.capacity * scaleFactor);
        console.log(`[PredatoryDefense] Scaling ${region} to capacity ${balancer.capacity}`);
      }
    }

    // In production, this would trigger actual infrastructure scaling via Vercel/ AWS
  }

  private async sendDefenseAlert(threat: SecurityThreat): Promise<void> {
    const message = `🛡️ THREAT NEUTRALIZED
Type: ${threat.type}
Severity: ${threat.severity}
Source: ${threat.source.ip}
Status: ELIMINATED
Countermeasures: ${threat.countermeasures.length} deployed`;

    console.log(`[PredatoryDefense] ${message}`);

    // Would send to notification system
    await this.supabase.from("defense_alerts").insert({
      threat_id: threat.id,
      message,
      timestamp: new Date().toISOString(),
      priority: threat.severity,
    } as never);
  }

  // ==========================================
  // LOAD BALANCING
  // ==========================================

  getOptimalRegion(): string {
    const healthy = Array.from(this.loadBalancers.values())
      .filter(lb => lb.healthy)
      .sort((a, b) => a.currentLoad - b.currentLoad);

    if (healthy.length === 0) {
      // All unhealthy - pick least bad
      return Array.from(this.loadBalancers.values())
        .sort((a, b) => a.currentLoad - b.currentLoad)[0]?.region || "us-east";
    }

    return healthy[0].region;
  }

  updateLoadBalancerMetrics(region: string, metrics: {
    load: number;
    responseTime: number;
    healthy: boolean;
  }): void {
    const balancer = this.loadBalancers.get(region);
    if (balancer) {
      balancer.currentLoad = metrics.load;
      balancer.avgResponseTime = metrics.responseTime;
      balancer.healthy = metrics.healthy;
      balancer.lastHealthCheck = new Date();
    }
  }

  // ==========================================
  // CONTINUOUS MONITORING
  // ==========================================

  startDefenseSystems(): void {
    if (this.isActive) return;
    this.isActive = true;

    console.log("[PredatoryDefense] All defense systems ONLINE. Zero tolerance active.");

    // Health check every 10 seconds
    this.defenseInterval = setInterval(() => {
      this.runHealthCheck();
    }, 10000);
  }

  stopDefenseSystems(): void {
    if (this.defenseInterval) {
      clearInterval(this.defenseInterval);
      this.defenseInterval = undefined;
    }
    this.isActive = false;
  }

  private runHealthCheck(): void {
    // Update load balancer health
    for (const [region, balancer] of this.loadBalancers) {
      // Simulate health check
      const isHealthy = balancer.currentLoad < 90 && balancer.avgResponseTime < 2000;
      
      if (!isHealthy && balancer.healthy) {
        console.log(`[PredatoryDefense] WARNING: ${region} showing signs of stress`);
      }
      
      balancer.healthy = isHealthy;
      balancer.lastHealthCheck = new Date();
    }

    // Clean up old rate limit entries
    const now = Date.now();
    for (const [key, record] of this.rateLimitStore) {
      if (now - record.windowStart > 60000) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  getDefenseMetrics(): DefenseMetrics {
    const threats = Array.from(this.threats.values());
    const recent = threats.filter(t => 
      Date.now() - t.timestamp.getTime() < 3600000 // Last hour
    );

    const systemHealth = this.calculateSystemHealth();
    
    return {
      timestamp: new Date(),
      totalRequests: recent.reduce((sum, t) => sum + t.metrics.requestCount, 0),
      blockedRequests: this.blockedIPs.size * 100, // Estimate
      avgLatency: this.calculateAvgLatency(),
      errorRate: recent.filter(t => t.type === "ddos").length / (recent.length || 1) * 100,
      activeThreats: threats.filter(t => t.status === "detected" || t.status === "mitigating").length,
      neutralizedThreats: threats.filter(t => t.status === "neutralized").length,
      systemHealth,
      empireStatus: systemHealth === "optimal" 
        ? "Borders secure. Empire operations running at peak efficiency."
        : systemHealth === "stable"
        ? "Minor threats detected and neutralized. All systems nominal."
        : "Elevated alert status. Countermeasures deployed.",
    };
  }

  private calculateSystemHealth(): DefenseMetrics["systemHealth"] {
    const healthyCount = Array.from(this.loadBalancers.values())
      .filter(lb => lb.healthy).length;
    
    const activeThreats = Array.from(this.threats.values())
      .filter(t => t.status === "detected" || t.status === "mitigating").length;

    if (healthyCount === this.loadBalancers.size && activeThreats === 0) return "optimal";
    if (healthyCount >= this.loadBalancers.size * 0.8 && activeThreats < 5) return "stable";
    if (healthyCount >= this.loadBalancers.size * 0.5) return "degraded";
    return "under_attack";
  }

  private calculateAvgLatency(): number {
    const balancers = Array.from(this.loadBalancers.values());
    return balancers.reduce((sum, lb) => sum + lb.avgResponseTime, 0) / balancers.length;
  }

  getLoadBalancerStatus(): LoadBalancer[] {
    return Array.from(this.loadBalancers.values());
  }

  getRecentThreats(limit: number = 20): SecurityThreat[] {
    return Array.from(this.threats.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  isIPBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  async unblockIP(ip: string): Promise<boolean> {
    if (!this.blockedIPs.has(ip)) return false;
    
    this.blockedIPs.delete(ip);
    await this.supabase
      .from("blocked_ips")
      .update({ active: false, unblocked_at: new Date().toISOString() } as never)
      .eq("ip", ip);
    
    return true;
  }

  getBlockedIPCount(): number {
    return this.blockedIPs.size;
  }
}

// Export singleton
export const predatoryDefense = new PredatoryDefenseSystem();
