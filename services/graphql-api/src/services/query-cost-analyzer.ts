import {
  DocumentNode,
  visit,
  FieldNode,
  InlineFragmentNode,
  FragmentDefinitionNode,
} from "graphql";
import type { GraphQLSchema } from "graphql";
import { AppError } from "../errors/AppError.js";

/**
 * Query cost analyzer — calculates the estimated computational cost of a GraphQL query
 * to prevent expensive nested queries that could cause DoS attacks or performance issues.
 *
 * Cost calculation:
 * - Each field: 1 point
 * - Each argument that accepts a list: +1 per element (max 10)
 * - Depth multiplier: fields at depth N cost N points
 * - Max allowed cost: configurable (default 1000)
 */

export interface QueryCostAnalyzerOptions {
  maxCost?: number;
  defaultFieldCost?: number;
  defaultListSize?: number;
  maxDepth?: number;
}

export interface CostMetrics {
  totalCost: number;
  maxDepth: number;
  fieldCount: number;
  exceededLimit: boolean;
}

export class QueryCostAnalyzer {
  private maxCost: number;
  private defaultFieldCost: number;
  private defaultListSize: number;
  private maxDepth: number;

  constructor(options: QueryCostAnalyzerOptions = {}) {
    this.maxCost = options.maxCost ?? 1000;
    this.defaultFieldCost = options.defaultFieldCost ?? 1;
    this.defaultListSize = options.defaultListSize ?? 10;
    this.maxDepth = options.maxDepth ?? 15;
  }

  /**
   * Analyze a GraphQL document and calculate its cost
   */
  analyze(document: DocumentNode): CostMetrics {
    let totalCost = 0;
    let maxDepth = 0;
    let fieldCount = 0;

    visit(document, {
      Field: (node, _key, _parent, _path, ancestors) => {
        fieldCount++;

        // Calculate depth (count Field nodes in ancestors)
        const depth = ancestors.filter(
          (a) =>
            a && typeof a === "object" && "kind" in a && a.kind === "Field",
        ).length;
        maxDepth = Math.max(maxDepth, depth);

        // Base cost for field
        let fieldCost = this.defaultFieldCost;

        // Add cost for list arguments (limit to defaultListSize)
        if (node.arguments) {
          for (const arg of node.arguments) {
            // If argument name suggests a collection size (first, last, limit, count)
            if (
              ["first", "last", "limit", "count", "take", "skip"].includes(
                arg.name.value,
              )
            ) {
              if (arg.value && "value" in arg.value) {
                const value = (arg.value as any).value;
                const size =
                  typeof value === "number"
                    ? Math.min(value, this.defaultListSize)
                    : this.defaultListSize;
                fieldCost += size;
              } else {
                fieldCost += this.defaultListSize;
              }
            }
          }
        }

        // Multiply cost by depth (deeper queries are more expensive)
        const depthMultiplier = Math.max(1, Math.floor(depth / 2));
        totalCost += fieldCost * depthMultiplier;
      },
    });

    return {
      totalCost,
      maxDepth,
      fieldCount,
      exceededLimit: totalCost > this.maxCost,
    };
  }

  /**
   * Check if a query is within cost limits
   * @throws Error if cost exceeds limit
   */
  validateQueryCost(document: DocumentNode): void {
    const metrics = this.analyze(document);

    if (metrics.exceededLimit) {
      throw new AppError(
        `Query cost limit exceeded: ${metrics.totalCost} > ${this.maxCost} ` +
          `(${metrics.fieldCount} fields, depth ${metrics.maxDepth})`,
        {
          code: "QUERY_TOO_COMPLEX",
          details: {
            totalCost: metrics.totalCost,
            maxCost: this.maxCost,
            fieldCount: metrics.fieldCount,
            maxDepth: metrics.maxDepth,
          },
        },
      );
    }

    if (metrics.maxDepth > this.maxDepth) {
      throw new AppError(
        `Query depth limit exceeded: ${metrics.maxDepth} > ${this.maxDepth}`,
        {
          code: "QUERY_TOO_COMPLEX",
          details: {
            depth: metrics.maxDepth,
            maxDepth: this.maxDepth,
          },
        },
      );
    }
  }

  /**
   * Get the configured maximum cost
   */
  getMaxCost(): number {
    return this.maxCost;
  }

  /**
   * Update the maximum allowed cost
   */
  setMaxCost(maxCost: number): void {
    this.maxCost = maxCost;
  }
}
