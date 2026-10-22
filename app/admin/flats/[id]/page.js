'use client'
import { useParams } from 'next/navigation'
import FlatView from '@/components/FlatView'

export default function FlatPage() {
  const { id } = useParams()
  return <FlatView flatId={id} admin />
}