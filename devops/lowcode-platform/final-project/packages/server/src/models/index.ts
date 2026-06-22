/**
 * 数据模型引擎入口
 * 提供动态数据模型的 CRUD 管理能力
 */

import { getPrismaClient, type ModelDefinition, type FieldDefinition, FieldType, RelationType } from './schema';

export { FieldType, RelationType };
export type { ModelDefinition, FieldDefinition };

/**
 * 模型管理器
 * 负责数据模型的创建、更新、删除和查询
 */
export class ModelManager {
  private prisma = getPrismaClient();

  /**
   * 创建新的数据模型
   * @param definition 模型定义
   * @param tenantId 租户 ID（多租户场景）
   */
  async createModel(definition: ModelDefinition, tenantId?: string) {
    // 验证模型名称合法性
    this.validateModelName(definition.name);
    // 验证字段定义
    this.validateFields(definition.fields);

    const model = await this.prisma.dataModel.create({
      data: {
        name: definition.name,
        displayName: definition.displayName,
        description: definition.description,
        fields: definition.fields as any,
        relations: definition.relations as any,
        tenantId,
      },
    });

    return model;
  }

  /**
   * 更新数据模型定义
   * 支持增量更新字段和关系
   */
  async updateModel(modelId: string, updates: Partial<ModelDefinition>) {
    const existing = await this.prisma.dataModel.findUnique({ where: { id: modelId } });
    if (!existing) {
      throw new Error(`模型不存在: ${modelId}`);
    }

    if (updates.fields) {
      this.validateFields(updates.fields);
    }

    const model = await this.prisma.dataModel.update({
      where: { id: modelId },
      data: {
        ...(updates.displayName && { displayName: updates.displayName }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.fields && { fields: updates.fields as any }),
        ...(updates.relations && { relations: updates.relations as any }),
      },
    });

    return model;
  }

  /**
   * 删除数据模型
   * 级联删除所有关联的数据记录
   */
  async deleteModel(modelId: string) {
    await this.prisma.dataModel.delete({ where: { id: modelId } });
  }

  /**
   * 获取模型列表
   */
  async listModels(tenantId?: string) {
    return this.prisma.dataModel.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * 获取单个模型详情
   */
  async getModel(modelId: string) {
    return this.prisma.dataModel.findUnique({ where: { id: modelId } });
  }

  /**
   * 根据模型名获取模型
   */
  async getModelByName(name: string, tenantId?: string) {
    return this.prisma.dataModel.findUnique({
      where: {
        name_tenantId: { name, tenantId: tenantId || null },
      },
    });
  }

  /**
   * 校验模型名称：只允许字母、数字、下划线，且以字母开头
   */
  private validateModelName(name: string) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      throw new Error(`模型名称 "${name}" 不合法，只允许字母、数字、下划线，且以字母开头`);
    }
  }

  /**
   * 校验字段定义
   */
  private validateFields(fields: FieldDefinition[]) {
    const names = new Set<string>();
    for (const field of fields) {
      if (names.has(field.name)) {
        throw new Error(`字段名 "${field.name}" 重复`);
      }
      names.add(field.name);

      if (field.type === FieldType.ENUM && (!field.enumValues || field.enumValues.length === 0)) {
        throw new Error(`枚举字段 "${field.name}" 必须定义枚举值`);
      }

      if (field.type === FieldType.RELATION && !field.relation) {
        throw new Error(`关联字段 "${field.name}" 必须定义关联关系`);
      }
    }
  }
}

/**
 * 数据记录管理器
 * 负责动态数据的 CRUD 操作
 */
export class RecordManager {
  private prisma = getPrismaClient();

  /**
   * 创建数据记录
   * @param modelId 模型 ID
   * @param data 记录数据
   */
  async createRecord(modelId: string, data: Record<string, unknown>) {
    const model = await this.prisma.dataModel.findUnique({ where: { id: modelId } });
    if (!model) {
      throw new Error(`模型不存在: ${modelId}`);
    }

    // 根据模型定义验证数据
    const fields = model.fields as unknown as FieldDefinition[];
    this.validateRecordData(fields, data);

    return this.prisma.dataRecord.create({
      data: {
        modelId,
        data: data as any,
      },
    });
  }

  /**
   * 批量创建数据记录
   */
  async createRecords(modelId: string, records: Record<string, unknown>[]) {
    const model = await this.prisma.dataModel.findUnique({ where: { id: modelId } });
    if (!model) {
      throw new Error(`模型不存在: ${modelId}`);
    }

    const fields = model.fields as unknown as FieldDefinition[];
    for (const record of records) {
      this.validateRecordData(fields, record);
    }

    return this.prisma.dataRecord.createMany({
      data: records.map((data) => ({ modelId, data: data as any })),
    });
  }

  /**
   * 查询数据记录（支持分页和筛选）
   */
  async queryRecords(
    modelId: string,
    options: {
      page?: number;
      pageSize?: number;
      filters?: Record<string, unknown>;
      sort?: { field: string; order: 'asc' | 'desc' };
    } = {}
  ) {
    const { page = 1, pageSize = 20, filters, sort } = options;
    const skip = (page - 1) * pageSize;

    // 构建 JSON 字段筛选条件
    const where: any = { modelId };
    if (filters) {
      // 使用 PostgreSQL JSON 查询
      const conditions = Object.entries(filters).map(([key, value]) => ({
        data: { path: [key], equals: value },
      }));
      if (conditions.length > 0) {
        where.AND = conditions;
      }
    }

    const [records, total] = await Promise.all([
      this.prisma.dataRecord.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: sort
          ? { data: { path: [sort.field], order: sort.order } as any }
          : { createdAt: 'desc' },
      }),
      this.prisma.dataRecord.count({ where }),
    ]);

    return {
      records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 更新数据记录
   */
  async updateRecord(recordId: string, data: Record<string, unknown>) {
    const existing = await this.prisma.dataRecord.findUnique({ where: { id: recordId } });
    if (!existing) {
      throw new Error(`记录不存在: ${recordId}`);
    }

    // 合并现有数据和更新数据
    const mergedData = { ...(existing.data as object), ...data };

    return this.prisma.dataRecord.update({
      where: { id: recordId },
      data: { data: mergedData as any },
    });
  }

  /**
   * 删除数据记录
   */
  async deleteRecord(recordId: string) {
    await this.prisma.dataRecord.delete({ where: { id: recordId } });
  }

  /**
   * 根据字段定义验证记录数据
   */
  private validateRecordData(fields: FieldDefinition[], data: Record<string, unknown>) {
    for (const field of fields) {
      const value = data[field.name];

      // 必填校验
      if (field.required && (value === undefined || value === null)) {
        throw new Error(`字段 "${field.displayName}" 为必填项`);
      }

      if (value === undefined || value === null) continue;

      // 类型校验
      switch (field.type) {
        case FieldType.NUMBER:
          if (typeof value !== 'number') {
            throw new Error(`字段 "${field.displayName}" 应为数字类型`);
          }
          if (field.validation?.min !== undefined && value < field.validation.min) {
            throw new Error(`字段 "${field.displayName}" 不能小于 ${field.validation.min}`);
          }
          if (field.validation?.max !== undefined && value > field.validation.max) {
            throw new Error(`字段 "${field.displayName}" 不能大于 ${field.validation.max}`);
          }
          break;

        case FieldType.TEXT:
        case FieldType.EMAIL:
        case FieldType.URL:
        case FieldType.PHONE:
          if (typeof value !== 'string') {
            throw new Error(`字段 "${field.displayName}" 应为文本类型`);
          }
          if (field.validation?.pattern && !new RegExp(field.validation.pattern).test(value)) {
            throw new Error(field.validation.message || `字段 "${field.displayName}" 格式不正确`);
          }
          break;

        case FieldType.BOOLEAN:
          if (typeof value !== 'boolean') {
            throw new Error(`字段 "${field.displayName}" 应为布尔类型`);
          }
          break;

        case FieldType.DATE:
          if (isNaN(Date.parse(value as string))) {
            throw new Error(`字段 "${field.displayName}" 应为有效日期`);
          }
          break;

        case FieldType.ENUM:
          if (!field.enumValues?.includes(value as string)) {
            throw new Error(`字段 "${field.displayName}" 的值不在允许范围内`);
          }
          break;
      }
    }
  }
}
