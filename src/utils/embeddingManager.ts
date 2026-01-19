import { pipeline, env } from '@xenova/transformers';

// 配置 Transformers.js 环境
env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * AI 向量管理器（单例模式）
 * 负责加载模型、生成文本向量、计算相似度
 */
class EmbeddingManager {
  private static instance: EmbeddingManager;
  private extractor: any = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): EmbeddingManager {
    if (!EmbeddingManager.instance) {
      EmbeddingManager.instance = new EmbeddingManager();
    }
    return EmbeddingManager.instance;
  }

  /**
   * 初始化模型
   * 使用 all-MiniLM-L6-v2 模型，体积约 23MB，适合桌面应用
   */
  async init(): Promise<void> {
    // 如果已经初始化完成，直接返回
    if (this.extractor) return;
    
    // 如果正在初始化，等待初始化完成
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }
    
    this.isInitializing = true;
    
    this.initPromise = (async () => {
      try {
        console.log('🤖 正在加载本地 AI 模型...');
        console.log('📦 模型信息: all-MiniLM-L6-v2 (~23MB)');
        
        // 加载特征提取模型
        this.extractor = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2'
        );
        
        console.log('✅ AI 模型加载成功！');
      } catch (error) {
        console.error('❌ AI 模型加载失败:', error);
        this.extractor = null;
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();
    
    return this.initPromise;
  }

  /**
   * 检查模型是否就绪
   */
  isReady(): boolean {
    return this.extractor !== null;
  }

  /**
   * 将文本转换为向量
   * @param text 输入文本
   * @returns 384 维的向量数组
   */
  async getEmbedding(text: string): Promise<number[]> {
    await this.init();
    
    if (!this.extractor) {
      throw new Error('AI 模型未就绪');
    }

    try {
      // 提取特征向量，使用平均池化和归一化
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true,
      });
      
      // 将 Tensor 转换为普通数组
      return Array.from(output.data);
    } catch (error) {
      console.error('❌ 生成向量失败:', error);
      throw error;
    }
  }

  /**
   * 计算两个向量之间的余弦相似度
   * @param vecA 向量 A
   * @param vecB 向量 B
   * @returns 相似度分数 (0-1，1 表示完全相同)
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    
    // 避免除以零
    if (norm === 0) return 0;
    
    return dotProduct / norm;
  }

  /**
   * 批量计算相似度并排序
   * @param queryVec 查询向量
   * @param candidates 候选项数组，每项包含 id 和 embedding
   * @param topK 返回前 K 个最相似的结果
   * @returns 排序后的结果数组，包含 id 和相似度分数
   */
  findSimilar<T extends { id: string; embedding?: number[] }>(
    queryVec: number[],
    candidates: T[],
    topK: number = 5
  ): Array<T & { similarity: number }> {
    const results: Array<T & { similarity: number }> = [];

    for (const candidate of candidates) {
      // 跳过没有向量的候选项
      if (!candidate.embedding || candidate.embedding.length === 0) {
        continue;
      }

      try {
        const similarity = this.cosineSimilarity(queryVec, candidate.embedding);
        results.push({ ...candidate, similarity });
      } catch (error) {
        console.warn(`计算相似度失败 (id: ${candidate.id}):`, error);
      }
    }

    // 按相似度降序排序
    results.sort((a, b) => b.similarity - a.similarity);

    // 返回前 K 个结果
    return results.slice(0, topK);
  }
}

// 导出单例实例
export const embeddingManager = EmbeddingManager.getInstance();
