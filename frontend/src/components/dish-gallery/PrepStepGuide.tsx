'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Clock, Thermometer, ChefHat, Play, Pause, RotateCcw } from 'lucide-react'
import { CookingStep } from '@/types'
import { SurfaceCard, ActionButton } from '@/components/primitives/primitiveExports'

interface CookingStepsProps {
  steps: CookingStep[]
  currentStep?: number
  onStepComplete?: (stepId: string) => void
  onStepChange?: (stepNumber: number) => void
  className?: string
}

const PrepStepGuide: React.FC<CookingStepsProps> = ({
  steps,
  currentStep = 0,
  onStepComplete,
  onStepChange,
  className = ''
}) => {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [timers, setTimers] = useState<Record<string, { remaining: number; isRunning: boolean }>>({})
  
  const handleStepComplete = (step: CookingStep) => {
    const newCompleted = new Set(completedSteps)
    
    if (newCompleted.has(step.id)) {
      newCompleted.delete(step.id)
    } else {
      newCompleted.add(step.id)
    }
    
    setCompletedSteps(newCompleted)
    onStepComplete?.(step.id)
    
    // 自动进入下一步
    if (!newCompleted.has(step.id) && step.stepNumber < steps.length) {
      onStepChange?.(step.stepNumber)
    }
  }
  
  const startTimer = (stepId: string, duration: number) => {
    setTimers(prev => ({
      ...prev,
      [stepId]: { remaining: duration * 60, isRunning: true }
    }))
    
    const interval = setInterval(() => {
      setTimers(prev => {
        const timer = prev[stepId]
        if (!timer || !timer.isRunning || timer.remaining <= 0) {
          clearInterval(interval)
          return prev
        }
        
        return {
          ...prev,
          [stepId]: { ...timer, remaining: timer.remaining - 1 }
        }
      })
    }, 1000)
  }
  
  const toggleTimer = (stepId: string) => {
    setTimers(prev => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        isRunning: !prev[stepId]?.isRunning
      }
    }))
  }
  
  const resetTimer = (stepId: string, duration: number) => {
    setTimers(prev => ({
      ...prev,
      [stepId]: { remaining: duration * 60, isRunning: false }
    }))
  }
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900 flex items-center">
          <ChefHat className="w-5 h-5 mr-2" />
          烹饪步骤
        </h3>
        
        <div className="text-sm text-gray-600">
          {completedSteps.size} / {steps.length} 已完成
        </div>
      </div>
      
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id)
          const isCurrent = currentStep === step.stepNumber - 1
          const timer = timers[step.id]
          
          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <SurfaceCard
                variant="glass"
                className={`cooking-step ${
                  isCurrent ? 'active' : isCompleted ? 'completed' : ''
                } cursor-pointer`}
                onClick={() => onStepChange?.(step.stepNumber - 1)}
              >
                <div className="p-6">
                  <div className="flex items-start space-x-4">
                    {/* 步骤编号/完成状态 */}
                    <div className="flex-shrink-0">
                      <motion.ActionButton
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStepComplete(step)
                        }}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                          isCompleted
                            ? 'bg-green-500 text-white'
                            : isCurrent
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <span className="font-medium">{step.stepNumber}</span>
                        )}
                      </motion.ActionButton>
                    </div>
                    
                    {/* 步骤内容 */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-medium text-gray-900 mb-2">
                        {step.title}
                      </h4>
                      
                      <p className="text-gray-700 mb-4 leading-relaxed">
                        {step.description}
                      </p>
                      
                      {/* 步骤信息 */}
                      <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                        {step.duration && (
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{step.duration}分钟</span>
                          </div>
                        )}
                        
                        {step.temperature && (
                          <div className="flex items-center space-x-1">
                            <Thermometer className="w-4 h-4" />
                            <span>{step.temperature}°C</span>
                          </div>
                        )}
                      </div>
                      
                      {/* 计时器 */}
                      {step.duration && (
                        <div className="mb-4">
                          <div className="flex items-center space-x-3">
                            {timer ? (
                              <>
                                <div className="timer-display text-lg font-mono">
                                  {formatTime(timer.remaining)}
                                </div>
                                
                                <ActionButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleTimer(step.id)
                                  }}
                                >
                                  {timer.isRunning ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </ActionButton>
                                
                                <ActionButton
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    resetTimer(step.id, step.duration!)
                                  }}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </ActionButton>
                              </>
                            ) : (
                              <ActionButton
                                variant="glass"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  startTimer(step.id, step.duration!)
                                }}
                              >
                                <Clock className="w-4 h-4 mr-2" />
                                开始计时
                              </ActionButton>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* 小贴士 */}
                      {step.tips && step.tips.length > 0 && (
                        <div className="bg-blue-50/50 rounded-lg p-3">
                          <h5 className="text-sm font-medium text-blue-900 mb-2">💡 小贴士</h5>
                          <ul className="space-y-1">
                            {step.tips.map((tip, tipIndex) => (
                              <li key={tipIndex} className="text-sm text-blue-800">
                                • {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    
                    {/* 步骤图片 */}
                    {step.imageUrl && (
                      <div className="flex-shrink-0 w-24 h-24">
                        <img
                          src={step.imageUrl}
                          alt={step.title}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </SurfaceCard>
            </motion.div>
          )
        })}
      </div>
      
      {/* 进度条 */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">烹饪进度</span>
          <span className="text-sm text-gray-600">
            {Math.round((completedSteps.size / steps.length) * 100)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            className="bg-green-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(completedSteps.size / steps.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  )
}

export default PrepStepGuide 