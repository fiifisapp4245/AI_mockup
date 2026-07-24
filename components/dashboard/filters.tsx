"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function FilterGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-6">{children}</div>
}

export function PrinterFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">Printer</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-24"
      />
    </div>
  )
}

export function LotIdFilter({
  value,
  onChange,
  lotIds,
}: {
  value: string
  onChange: (value: string) => void
  lotIds: string[]
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">LotId</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All</SelectItem>
          {lotIds.map((lotId) => (
            <SelectItem key={lotId} value={lotId}>
              {lotId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function CalendarButton({
  date,
  onChange,
}: {
  date: Date
  onChange: (date: Date) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-[160px] justify-between font-normal"
        >
          {format(date, "M/d/yyyy")}
          <CalendarIcon className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selected) => selected && onChange(selected)}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  )
}

export function DateRangeFilter({
  label,
  start,
  end,
  onChangeStart,
  onChangeEnd,
}: {
  label: string
  start: Date
  end: Date
  onChangeStart: (date: Date) => void
  onChangeEnd: (date: Date) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <CalendarButton date={start} onChange={onChangeStart} />
        <CalendarButton date={end} onChange={onChangeEnd} />
      </div>
    </div>
  )
}
