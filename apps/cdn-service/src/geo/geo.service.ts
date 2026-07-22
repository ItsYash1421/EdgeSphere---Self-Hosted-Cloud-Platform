import { Injectable } from "@nestjs/common";

export type CacheRegion = "us-east-1" | "eu-west-1" | "ap-south-1" | "unknown";

@Injectable()
export class GeoService {
  getNearestRegion(ip: string): CacheRegion {
    if (!ip) return "us-east-1";
    
    // Uses first octet to simulate geo (for local dev):
    // 1-100 -> us-east-1, 101-200 -> eu-west-1, 201-255 -> ap-south-1
    const parts = ip.split(".");
    if (parts.length > 0) {
      const firstOctet = parseInt(parts[0], 10);
      if (!isNaN(firstOctet)) {
        if (firstOctet <= 100) return "us-east-1";
        if (firstOctet <= 200) return "eu-west-1";
        return "ap-south-1";
      }
    }
    
    return "us-east-1";
  }

  getAvailableRegions(): { region: string; endpoint: string; status: string }[] {
    return [
      { region: "us-east-1", endpoint: "cdn-us.edgesphere.local", status: "online" },
      { region: "eu-west-1", endpoint: "cdn-eu.edgesphere.local", status: "online" },
      { region: "ap-south-1", endpoint: "cdn-ap.edgesphere.local", status: "online" },
    ];
  }
}
