import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 max-w-2xl mx-auto mt-8">
          <Card className="border-destructive/50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                <h2 className="font-heading font-bold text-lg">Something went wrong</h2>
              </div>
              <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-48 text-destructive">
                {this.state.error.message}
              </pre>
              <p className="text-xs text-muted-foreground">
                {this.state.error.stack?.split('\n').slice(0, 5).join('\n')}
              </p>
              <Button variant="outline" onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}>
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
